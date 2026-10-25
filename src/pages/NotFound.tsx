import { Link } from 'react-router-dom';
import { Empty } from '../components/States';
export default function NotFound() {
  return <Empty title="Page not found">That page does not exist. <Link to="/" className="text-accent">Go to the homepage</Link></Empty>;
}
