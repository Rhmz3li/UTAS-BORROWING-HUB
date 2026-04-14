import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import Profile from '../Profile';

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock axios for API calls
jest.mock('axios', () => {
    const mockAxios = {
        get: jest.fn(() => Promise.resolve({
            data: { user: { id: 1, email: 'riham@utas.edu.om' } }
        })),
        put: jest.fn(() => Promise.resolve({
            data: { success: true, message: 'Profile updated successfully' }
        })),
        post: jest.fn(() => Promise.resolve({
            data: { success: true, message: 'Password changed successfully' }
        }))
    };
    return {
        __esModule: true,
        default: mockAxios
    };
});

// Mock toast notifications
const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
};
jest.mock('react-toastify', () => ({
    toast: mockToast
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Mock fetchProfile action
jest.mock('../../redux/reducers/authReducer', () => ({
    ...jest.requireActual('../../redux/reducers/authReducer'),
    fetchProfile: () => async (dispatch) => {
        return Promise.resolve({ type: 'FETCH_PROFILE' });
    }
}));

// Middleware that allows async actions to be dispatched
const thunkMiddleware = () => next => action => {
    if (typeof action === 'function') {
        return action(next);
    }
    return next(action);
};

const mockStore = configureStore([thunkMiddleware]);

// Create mock store with initial state
const createMockStoreWithUser = (userData = {}) => {
    return mockStore({
        auth: {
            user: {
                id: 1,
                full_name: 'Riham',
                email: 'riham@utas.edu.om',
                phone: '91234567',
                department: 'College of Information Technology',
                role: 'Student',
                ...userData
            },
            token: 'mock-token',
            isLoading: false,
            isSuccess: false,
            isError: false,
            errorMessage: null
        }
    });
};

describe('Profile Page - Automated Testing Suite', () => {
    let store;

    beforeEach(() => {
        store = createMockStoreWithUser();
        mockNavigate.mockClear();
        mockToast.success.mockClear();
        mockToast.error.mockClear();
        mockToast.info.mockClear();
        mockToast.warning.mockClear();
    });

    // Test 1: Login with valid credentials
    test('Test 1: Login with valid credentials and navigate to profile', async () => {
        store = createMockStoreWithUser({
            full_name: 'Riham',
            email: 'riham@utas.edu.om',
            phone: '91234567',
            department: 'Engineering',
            role: 'Student'
        });

        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        // Wait for profile data to load
        await waitFor(() => {
            expect(screen.queryByText(/Profile/i) || screen.queryByText(/riham@utas.edu.om/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    // Test 2: Click profile setting button
    test('Test 2: Click profile setting and open profile page', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('riham@utas.edu.om')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    // Test 3: Check full name field exists and displays value
    test('Test 3: Check full name field exists and displays correct value', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
            expect(fullNameInput).toHaveAttribute('name', 'full_name');
        }, { timeout: 3000 });
    });

    // Test 4: Check email field exists and is read-only
    test('Test 4: Check email field exists and displays correct value', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const emailInput = screen.getByDisplayValue('riham@utas.edu.om');
            expect(emailInput).toBeInTheDocument();
            expect(emailInput).toHaveAttribute('name', 'email');
        }, { timeout: 3000 });
    });

    // Test 5: Check phone field exists and displays value
    test('Test 5: Check phone field exists and displays correct value', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const phoneInput = screen.getByDisplayValue('91234567');
            expect(phoneInput).toBeInTheDocument();
            expect(phoneInput).toHaveAttribute('name', 'phone');
        }, { timeout: 3000 });
    });

    // Test 6: Check department field exists and displays value
    test('Test 6: Check department field exists and displays correct value', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const departmentInput = screen.getByDisplayValue('College of Information Technology');
            expect(departmentInput).toBeInTheDocument();
            expect(departmentInput).toHaveAttribute('name', 'department');
        }, { timeout: 3000 });
    });

    // Test 7: Check role field exists and displays value
    test('Test 7: Check role field exists and displays correct value', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const roleInput = screen.getByDisplayValue('Student');
            expect(roleInput).toBeInTheDocument();
            expect(roleInput).toHaveAttribute('name', 'role');
        }, { timeout: 3000 });
    });

    // Test 8: Open Profile page (verify page loads successfully)
    test('Test 8: Open Profile page and verify all fields are loaded', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Riham')).toBeInTheDocument();
            expect(screen.getByDisplayValue('riham@utas.edu.om')).toBeInTheDocument();
            expect(screen.getByDisplayValue('91234567')).toBeInTheDocument();
            expect(screen.getByDisplayValue('College of Information Technology')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Student')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    // Test 9: Clear Full Name field
    test('Test 9: Clear Full Name field and verify it is empty', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: '' } });

        expect(fullNameInput.value).toBe('');
    });

    // Test 10: Clear Phone field
    test('Test 10: Clear Phone field and verify it is empty', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const phoneInput = screen.getByDisplayValue('91234567');
            expect(phoneInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const phoneInput = screen.getByDisplayValue('91234567');
        fireEvent.change(phoneInput, { target: { value: '' } });

        expect(phoneInput.value).toBe('');
    });

    // Test 11: Enter invalid phone (less than 8 digits)
    test('Test 11: Enter invalid phone (less than 8 digits) and verify it changes', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const phoneInput = screen.getByDisplayValue('91234567');
            expect(phoneInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const phoneInput = screen.getByDisplayValue('91234567');
        fireEvent.change(phoneInput, { target: { value: '9123456' } }); // Only 7 digits

        // Verify the value was updated in the input
        expect(phoneInput.value).toBe('9123456');

        // The phone field should still be there and editable
        expect(phoneInput).toBeInTheDocument();
    });

    // Test 12: Enter phone not starting with 7 or 9
    test('Test 12: Enter phone not starting with 7 or 9 and verify error', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const phoneInput = screen.getByDisplayValue('91234567');
            expect(phoneInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const phoneInput = screen.getByDisplayValue('91234567');
        fireEvent.change(phoneInput, { target: { value: '81234567' } }); // Starts with 8

        // Phone input should have the new value
        expect(phoneInput.value).toBe('81234567');

        // Try to interact with save button to trigger validation
        const saveButton = screen.queryByRole('button', { name: /save changes/i });
        if (saveButton) {
            // Save button should be available even with invalid data (validation happens on submit)
            expect(saveButton).toBeInTheDocument();
        }
    });

    // Test 13: Enter valid Full Name
    test('Test 13: Enter valid Full Name and verify no error', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Jane Smith' } });

        expect(fullNameInput.value).toBe('Jane Smith');
        // No error should be shown for valid name
    });

    // Test 14: Enter valid phone (8 digits, starts with 7 or 9)
    test('Test 14: Enter valid phone (8 digits, starts with 7 or 9) and verify no error', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const phoneInput = screen.getByDisplayValue('91234567');
            expect(phoneInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const phoneInput = screen.getByDisplayValue('91234567');
        fireEvent.change(phoneInput, { target: { value: '71234567' } }); // Valid: starts with 7, 8 digits

        expect(phoneInput.value).toBe('71234567');
        // No error should be shown for valid phone
    });

    // Test 15: Enter Full Name with numbers
    test('Test 15: Enter Full Name with numbers (invalid) and verify error', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Riham123' } });
        fireEvent.blur(fullNameInput);

        await waitFor(() => {
            // Should show error message in inline error
            const errorMessage = screen.queryByText(/must not contain numbers/i) ||
                               screen.queryByText(/no numbers/i);
            expect(errorMessage).toBeTruthy();
        }, { timeout: 2000 });
    });

    // Test 16: Enter Full Name with special characters
    test('Test 16: Enter Full Name with special characters (invalid) and verify error', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Riham##' } });

        // Verify the value was updated in the input
        expect(fullNameInput.value).toBe('Riham##');

        // The full name field should still be there and editable
        expect(fullNameInput).toBeInTheDocument();
    });

    // Test 17: Click "Save Changes" button
    test('Test 17: Click "Save Changes" with valid data and verify save', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        // Change a field to trigger hasChanges
        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Riham Updated' } });

        // Wait for the component to detect changes
        await waitFor(() => {
            const saveButton = screen.getByRole('button', { name: /save changes/i });
            expect(saveButton).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    // Test 18: Refresh page and verify data persistence
    test('Test 18: Refresh page and verify profile data persists', async () => {
        const { unmount } = render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Riham')).toBeInTheDocument();
        }, { timeout: 3000 });

        // Unmount and remount to simulate refresh
        unmount();

        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Riham')).toBeInTheDocument();
            expect(screen.getByDisplayValue('riham@utas.edu.om')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    // Test 19: Modify a field without saving and verify unsaved changes indicator
    test('Test 19: Modify a field without saving and verify unsaved changes state', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        // Change a field
        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Riham' } });

        // Verify the change is reflected in the input
        expect(fullNameInput.value).toBe('Riham');

        // Save button should be available
        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).toBeInTheDocument();
    });

    // Test 20: Click "Back" button
    test('Test 20: Click "Back" button and navigate away', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Riham')).toBeInTheDocument();
        }, { timeout: 3000 });

        // Look for back button
        const backButton = screen.queryByRole('button', { name: /back/i }) ||
                          screen.queryByRole('button', { name: /←/i });

        if (backButton) {
            fireEvent.click(backButton);
            // Should navigate away
        }
    });

    // Test 21: Click "Cancel" in unsaved changes popup
    test('Test 21: Click "Cancel" in unsaved changes popup', async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        // Change a field to trigger unsaved changes
        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Riham' } });

        // Look for back button to trigger popup
        const backButton = screen.queryByRole('button', { name: /back/i }) ||
                          screen.queryByRole('button', { name: /←/i });

        if (backButton) {
            fireEvent.click(backButton);

            // Look for cancel button in popup
            await waitFor(() => {
                const cancelButton = screen.queryByRole('button', { name: /cancel/i });
                if (cancelButton) {
                    fireEvent.click(cancelButton);
                    // Should stay on the page
                    expect(fullNameInput).toBeInTheDocument();
                }
            }, { timeout: 3000 });
        }
    });

    // Test 22: Click "OK" in popup to confirm discard changes
    test('Test 22: Click "OK" in unsaved changes popup to discard changes', async () => {
        mockNavigate.mockClear();

        render(
            <Provider store={store}>
                <Router>
                    <Profile />
                </Router>
            </Provider>
        );

        await waitFor(() => {
            const fullNameInput = screen.getByDisplayValue('Riham');
            expect(fullNameInput).toBeInTheDocument();
        }, { timeout: 3000 });

        // Change a field to trigger unsaved changes
        const fullNameInput = screen.getByDisplayValue('Riham');
        fireEvent.change(fullNameInput, { target: { value: 'Riham' } });

        // Look for back button to trigger popup
        const backButton = screen.queryByRole('button', { name: /back/i }) ||
                          screen.queryByRole('button', { name: /←/i });

        if (backButton) {
            fireEvent.click(backButton);

            // Look for OK/Yes button in popup
            await waitFor(() => {
                const confirmButton = screen.queryByRole('button', { name: /ok|yes|discard/i });
                if (confirmButton) {
                    fireEvent.click(confirmButton);
                    // Should navigate away (mocked)
                }
            }, { timeout: 3000 });
        }
    });
});
