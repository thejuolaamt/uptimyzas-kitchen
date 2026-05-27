'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { Send, Image, X } from 'lucide-react'

type ChatMessage = {
  id: string
  user_id: string
  user_name?: string
  message_type: string
  content: string | null
  image_url: string | null
  created_at: string
}

export default function ChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else {
      setSession(userSession)
      fetchMessages()
      subscribeToMessages()
    }
  }, [router])

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.error('Fetch error:', error)
        setLoading(false)
        return
      }

      if (data && data.length > 0) {
        // Fetch user names separately
        const messagesWithNames: ChatMessage[] = []
        for (const msg of data) {
          const { data: userData } = await supabase
            .from('users')
            .select('first_name, surname')
            .eq('id', msg.user_id)
            .single()
          
          messagesWithNames.push({
            ...msg,
            user_name: userData ? `${userData.first_name} ${userData.surname}` : 'Unknown'
          })
        }
        
        setMessages(messagesWithNames)
        setTimeout(scrollToBottom, 100)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    }
    setLoading(false)
  }

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('chat-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          const { data: userData } = await supabase
            .from('users')
            .select('first_name, surname')
            .eq('id', payload.new.user_id)
            .single()

          const newMsg: ChatMessage = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            message_type: payload.new.message_type,
            content: payload.new.content,
            image_url: payload.new.image_url,
            created_at: payload.new.created_at,
            user_name: userData ? `${userData.first_name} ${userData.surname}` : 'Unknown'
          }
          setMessages(prev => [...prev, newMsg])
          setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendTextMessage = async () => {
    if (!newMessage.trim()) return

    setSending(true)
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: session.id,
        message_type: 'text',
        content: newMessage.trim()
      })

    if (error) {
      console.error('Send error:', error)
      alert('Error sending message: ' + error.message)
    } else {
      setNewMessage('')
    }
    setSending(false)
  }

  const uploadImage = async (file: File) => {
    const fileName = `${Date.now()}.${file.name.split('.').pop()}`
    const filePath = `chat-images/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file)

    if (uploadError) {
      alert('Error uploading image: ' + uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewImage(reader.result as string)
    }
    reader.readAsDataURL(file)
    
    ;(window as any).selectedImageFile = file
  }

  const confirmImageUpload = async () => {
    const file = (window as any).selectedImageFile
    if (!file) return

    setUploadingImage(true)
    const imageUrl = await uploadImage(file)

    if (imageUrl) {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: session.id,
          message_type: 'image',
          image_url: imageUrl
        })

      if (error) {
        alert('Error sending image: ' + error.message)
      }
    }

    setPreviewImage(null)
    setShowImageUpload(false)
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    delete (window as any).selectedImageFile
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="h-screen flex flex-col bg-bg-subtle">
      {/* Chat Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-10">
        <h1 className="font-bold text-text-primary text-lg">Kitchen Chat</h1>
        <p className="text-text-secondary text-sm">Team Communication</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {messages.length === 0 ? (
          <div className="text-center text-text-muted mt-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.user_id === session?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] ${msg.user_id === session?.id ? 'items-end' : 'items-start'}`}>
                <p className="text-xs text-text-muted mb-1 px-1">
                  {msg.user_name} • {formatTime(msg.created_at)}
                </p>
                <div className={`rounded-lg p-3 ${
                  msg.user_id === session?.id
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border'
                }`}>
                  {msg.message_type === 'text' && (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  {msg.message_type === 'image' && msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Shared image"
                      className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition"
                      onClick={() => window.open(msg.image_url!, '_blank')}
                    />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden">
            <img src={previewImage} alt="Preview" className="w-full h-auto max-h-96 object-cover" />
            <div className="p-4 flex gap-3">
              <button
                onClick={confirmImageUpload}
                disabled={uploadingImage}
                className="btn-primary flex-1"
              >
                {uploadingImage ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={() => {
                  setPreviewImage(null)
                  setShowImageUpload(false)
                  delete (window as any).selectedImageFile
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageUpload && !previewImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">Send Image</h2>
              <button onClick={() => setShowImageUpload(false)} className="text-text-muted">
                <X size={20} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="input-base"
            />
            <p className="text-text-muted text-xs mt-2">Select an image to share with the team</p>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-border p-3 sticky bottom-0">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowImageUpload(true)}
            className="p-2 text-text-secondary hover:text-primary transition-colors rounded-full"
            disabled={sending}
          >
            <Image size={22} />
          </button>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
            placeholder="Type a message..."
            className="flex-1 input-base"
            disabled={sending}
          />
          
          <button
            onClick={sendTextMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-primary text-white p-2 px-5 rounded-default font-semibold disabled:opacity-50 hover:bg-primary-hover transition"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}