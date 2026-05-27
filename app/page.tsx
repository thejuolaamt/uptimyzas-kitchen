import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: users, error } = await supabase
    .from('users')
    .select('email, first_name, surname, role')
    .eq('email', 'admin@uptimyzaskitchen.com')

  if (error) {
    console.error('Error:', error)
    return <div>Database connection failed: {error.message}</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-subtle">
      <div className="card max-w-md w-full">
        <h1 className="font-display font-bold text-2xl text-primary mb-4">Uptimyzas Kitchen</h1>
        <p className="text-text-secondary mb-4">Database connected successfully!</p>
        {users && users.length > 0 && (
          <div className="bg-primary-light p-4 rounded-default">
            <p className="text-text-primary font-semibold">Admin found:</p>
            <p>{users[0].email} - {users[0].role}</p>
          </div>
        )}
      </div>
    </div>
  )
}