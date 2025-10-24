import { redirect } from 'next/navigation';

const Homepage = () => {
  redirect('/login');
}

export default Homepage;
