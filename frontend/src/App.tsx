import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './features/shared/auth/AuthContext';
import { ToastProvider } from './features/shared/components/ToastProvider';
import { router } from './router';

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}
