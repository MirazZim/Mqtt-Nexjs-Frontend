// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
    // Redirect to English login by default
    redirect('/en/login');
}