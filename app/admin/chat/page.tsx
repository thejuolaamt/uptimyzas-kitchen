'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Send, ImageIcon, X } from 'lucide-react'

type ChatMessage = {
  id: string
  user_id: string
  user_name?: string
  message_type: string
  content: string | null
  image_url: string | null
  created_at: string
}

export default function AdminChatPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const userSession = getSession()
    if (!userSession) {
      router.push('/auth/login')
    } else if (userSession.role !== 'admin') {
      router.push('/dashboard')
    } else {
      setSession(userSession)
      fetchMessages()
      const unsub = subscribeToMessages()
      return unsub
    }
  }, [router])

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) { setLoading(false); return }

    if (data && data.length > 0) {
      const withNames: ChatMessage[] = []
      for (const msg of data) {
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, surname')
          .eq('id', msg.user_id)
          .single()
        withNames.push({ ...msg, user_name: userData ? `${userData.first_name} ${userData.surname}` : 'Unknown' })
      }
      setMessages(withNames)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setLoading(false)
  }

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('admin-chat-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
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
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      )
      .subscribe()

    return () => { subscription.unsubscribe() }
  }

  const sendTextMessage = async () => {
    if (!newMessage.trim()) return
    setSending(true)

    const { error } = await supabase
      .from('chat_messages')
      .insert({ user_id: session.id, message_type: 'text', content: newMessage.trim() })

    if (error) toast('Error sending message: ' + error.message, 'error')
    else setNewMessage('')
    setSending(false)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'warning'); return }
    const reader = new FileReader()
    reader.onloadend = () => setPreviewImage(reader.result as string)
    reader.readAsDataURL(file)
    setSelectedFile(file)
  }

  const confirmImageUpload = async () => {
    if (!selectedFile) return
    setUploadingImage(true)

    const fileName = `${Date.now()}.${selectedFile.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(`chat-images/${fileName}`, selectedFile)

    if (uploadError) {
      toast('Error uploading image: ' + uploadError.message, 'error')
      setUploadingImage(false)
      return
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(`chat-images/${fileName}`)
    const { error } = await supabase.from('chat_messages').insert({
      user_id: session.id, message_type: 'image', image_url: urlData.publicUrl
    })
    if (error) toast('Error sending image: ' + error.message, 'error')

    setPreviewImage(null)
    setSelectedFile(null)
    setShowImageUpload(false)
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-subtle flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-bg-subtle">

      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-3 flex-shrink-0">
        <p className="t-h3 text-text-primary">Kitchen Chat</p>
        <p className="t-small text-text-secondary mt-0.5">Team communication — Admin view</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center mt-16">
            <p className="t-body text-text-muted">No messages yet</p>
            <p className="t-small text-text-muted mt-1">Messages from all staff appear here</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.user_id === session?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[60%] flex flex-col ${msg.user_id === session?.id ? 'items-end' : 'items-start'}`}>
                <p className="t-small text-text-muted mb-1 px-1">
                  {msg.user_name} · {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className={`rounded-[12px] px-3 py-2 ${
                  msg.user_id === session?.id ? 'bg-primary text-white' : 'bg-white border border-border'
                }`}>
                  {msg.message_type === 'text' && (
                    <p className="t-body whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  {msg.message_type === 'image' && msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Shared"
                      className="max-w-full rounded-[8px] max-h-64 object-cover cursor-pointer"
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

      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] overflow-hidden">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mt-4 mb-3" />
            <img src={previewImage} alt="Preview" className="w-full max-h-72 object-cover" />
            <div className="p-4 flex gap-3">
              <button onClick={() => { setPreviewImage(null); setSelectedFile(null); setShowImageUpload(false) }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmImageUpload} disabled={uploadingImage} className="btn-primary flex-1">
                {uploadingImage ? 'Sending...' : 'Send Image'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image select modal */}
      {showImageUpload && !previewImage && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-5">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <div className="flex justify-between items-center mb-4">
              <p className="t-h2 text-text-primary">Send Image</p>
              <button onClick={() => setShowImageUpload(false)} className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="input-base" />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white border-t border-border px-4 py-3 flex-shrink-0">
        <div className="flex gap-2 items-center max-w-4xl mx-auto">
          <button
            onClick={() => setShowImageUpload(true)}
            className="text-text-secondary min-h-0 min-w-0 w-9 h-9 flex items-center justify-center rounded-[8px] bg-bg-subtle"
          >
            <ImageIcon size={18} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
            placeholder="Type a message to the team..."
            className="flex-1 input-base"
            disabled={sending}
          />
          <button
            onClick={sendTextMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-primary text-white min-h-0 min-w-0 w-10 h-10 rounded-[10px] flex items-center justify-center disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

    </div>
  )
}