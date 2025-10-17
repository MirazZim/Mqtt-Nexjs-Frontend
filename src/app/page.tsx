'use client'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
const Homepage = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}>
      Redirecting...
    </div>
  )
}

export default Homepage
