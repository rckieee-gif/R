import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Login from '../features/auth/Login';
import { apiClient } from '../shared/utils/apiClient';
import NotificationProvider from '../shared/components/NotificationProvider';

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form elements', () => {
    render(
      <NotificationProvider>
        <Login onLogin={vi.fn()} />
      </NotificationProvider>
    );

    expect(screen.getByPlaceholderText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls apiClient.post on submit and handles successful login', async () => {
    const mockOnLogin = vi.fn();
    const mockUser = { id: 1, name: 'Roland', role: 'Admin' };

    apiClient.post.mockResolvedValueOnce({
      user: mockUser,
    });

    render(
      <NotificationProvider>
        <Login onLogin={mockOnLogin} />
      </NotificationProvider>
    );

    const usernameInput = screen.getByPlaceholderText(/username or email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(usernameInput, { target: { value: 'admin.roland' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
        login: 'admin.roland',
        email: 'admin.roland',
        password: 'password123',
      });
      expect(mockOnLogin).toHaveBeenCalledWith(mockUser);
    });
  });

  it('displays error message on failed login', async () => {
    const mockErrorMessage = 'Invalid username or password';
    apiClient.post.mockRejectedValueOnce(new Error(mockErrorMessage));

    render(
      <NotificationProvider>
        <Login onLogin={vi.fn()} />
      </NotificationProvider>
    );

    const usernameInput = screen.getByPlaceholderText(/username or email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(usernameInput, { target: { value: 'wrong.user' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const errorElements = screen.getAllByText(mockErrorMessage);
      expect(errorElements.length).toBeGreaterThan(0);
      errorElements.forEach(el => expect(el).toBeInTheDocument());
    });
  });
});
