import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { SessionProvider } from '@/app/session';
import { router } from '@/app/router';
import '@/styles/theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');
createRoot(root).render(<StrictMode><SessionProvider><RouterProvider router={router} /></SessionProvider></StrictMode>);
