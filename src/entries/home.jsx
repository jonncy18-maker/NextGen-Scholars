import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { NGSSite } from '../screens/HomePage.jsx';

export function HomeRoute() {
  const isDesktop = useMediaQuery('(min-width: 960px)');
  return <NGSSite isDesktop={isDesktop} />;
}
