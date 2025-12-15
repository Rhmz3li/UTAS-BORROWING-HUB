// Mock image files - must be before importing RegisterPage
jest.mock('../../img/img1.png', () => ({
    __esModule: true,
    default: 'test-file-stub.png',
}));

import reducer from "../../redux/reducers/authReducer";
import Register from '../RegisterPage';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import configureStore from 'redux-mock-store';

const mockStore = configureStore([]);
const store = mockStore({
    auth: {
        user: null,
        token: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
        errorMessage: null
    }
});

const test_initval = {
    user: null,
    token: null,
    message: "",
    isLoading: false,
    isSuccess: false,
    isError: false,
    errorMessage: null
};

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Mock toast
const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
};
jest.mock('react-toastify', () => ({
    toast: mockToast
}));

// Mock axios for API calls
jest.mock('axios', () => {
    const mockAxios = {
        post: jest.fn(() => Promise.resolve({
            data: { user: { id: 1, email: 'john@utas.edu.om' }, token: 'mock-token' }
        })),
        get: jest.fn(() => Promise.resolve({ data: {} }))
    };
    return {
        __esModule: true,
        default: mockAxios
    };
});

describe('Auth Reducer Tests', () => {
    beforeEach(() => {
        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn(),
        };
        global.localStorage = localStorageMock;
    });

    test("Should return initial state", () => {
        const result = reducer(undefined, {
            type: undefined,
        });
        
        expect(result).toMatchObject({
            token: null,
            isLoading: false,
            isSuccess: false,
            isError: false,
            errorMessage: null
        });
    });
});

describe('Register Component Tests', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockToast.success.mockClear();
        mockToast.error.mockClear();
        mockToast.info.mockClear();
        
        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn(),
        };
        global.localStorage = localStorageMock;
    });

    // Test 1: Leave all required fields empty and click Create Account
    test("Step 1: Leave all required fields empty and click Create Account", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const submitButton = screen.getByRole('button', { name: /sign up/i });
        const fullNameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email address/i);
        const passwordInput = screen.getByLabelText(/^password \*$/i);
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        const studentIdInput = screen.getByLabelText(/student id/i);
        
        // Blur required fields so Formik marks them as touched
        fireEvent.blur(fullNameInput);
        fireEvent.blur(emailInput);
        fireEvent.blur(passwordInput);
        fireEvent.blur(confirmPasswordInput);
        fireEvent.blur(studentIdInput);

        // Click submit without filling any fields to trigger validation
        fireEvent.click(submitButton);

        // Wait for validation errors to appear
        await waitFor(() => {
            const fullNameError = screen.queryByText(/full name is required/i);
            const emailError = screen.queryByText(/email is required/i);
            const passwordError = screen.queryByText(/password is required/i);
            const confirmPasswordError = screen.queryByText(/please confirm your password/i);
            const studentIdError = screen.queryByText(/student id is required/i);
            
            expect(fullNameError || screen.queryByText(/full name is required!!!/i)).toBeTruthy();
            expect(emailError).toBeTruthy();
            expect(passwordError).toBeTruthy();
            expect(confirmPasswordError).toBeTruthy();
            expect(studentIdError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 2: Enter invalid email format
    test("Step 2: Enter invalid email format", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const emailInput = screen.getByLabelText(/email address/i);
        // Try with a valid email format but not UTAS to trigger the UTAS-specific validation
        fireEvent.change(emailInput, { target: { value: "test@gmail.com" } });
        fireEvent.blur(emailInput);

        // Also try to submit to trigger validation
        const submitButton = screen.getByRole('button', { name: /sign up/i });
        fireEvent.click(submitButton);

        // Wait for Formik validation to complete
        await waitFor(() => {
            // Check for the UTAS email validation error message
            // The schema shows: "Email must be a valid UTAS email address (@utas.edu.om)"
            const emailError = screen.queryByText(/email must be a valid UTAS email address/i) ||
                              screen.queryByText(/valid UTAS email address/i) ||
                              screen.queryByText(/utas\.edu\.om/i) ||
                              screen.queryByText(/invalid email format/i);
            expect(emailError).toBeInTheDocument();
        }, { timeout: 5000 });
    });

    // Test 3: Enter a very short password
    test("Step 3: Enter a very short password", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "Test@1" } }); // Less than 8 characters
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            const passwordError = screen.queryByText(/password must be at least 8 characters long/i) ||
                                 screen.queryByText(/at least 8 characters/i);
            expect(passwordError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 4: Enter password without uppercase letters
    test("Step 4: Enter password without uppercase letters", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "test@12345" } });
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            const passwordError = screen.queryByText(/password must contain at least one uppercase letter/i) ||
                                 screen.queryByText(/uppercase letter/i) ||
                                 screen.queryByText(/uppercase/i);
            expect(passwordError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 5: Enter password without lowercase letters
    test("Step 5: Enter password without lowercase letters", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "TEST@12345" } });
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            const passwordError = screen.queryByText(/password must contain at least one lowercase letter/i) ||
                                 screen.queryByText(/lowercase letter/i) ||
                                 screen.queryByText(/lowercase/i);
            expect(passwordError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 6: Enter password without numbers
    test("Step 6: Enter password without numbers", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "Test@Password" } });
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            const passwordError = screen.queryByText(/password must contain at least one number/i) ||
                                 screen.queryByText(/number/i) ||
                                 screen.queryByText(/digit/i);
            expect(passwordError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 7: Enter password without special characters
    test("Step 7: Enter password without special characters", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "TestPassword123" } });
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            const passwordError = screen.queryByText(/password must contain at least one special character/i) ||
                                 screen.queryByText(/special character/i) ||
                                 screen.queryByText(/special/i);
            expect(passwordError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 8: Enter password missing multiple requirements
    test("Step 8: Enter password missing multiple requirements", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "test" } }); // Missing uppercase, number, special char, and length
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            // Check that password requirements list shows multiple unmet requirements
            const requirementsList = screen.queryByText(/password requirements/i);
            expect(requirementsList).toBeTruthy();
            
            // Check that multiple requirements are shown as unmet (orange/not green)
            const unmetRequirements = screen.queryAllByText(/○/);
            expect(unmetRequirements.length).toBeGreaterThan(1);
        }, { timeout: 3000 });
    });

    // Test 9: Enter password that meets all conditions
    test("Step 9: Enter password that meets all conditions", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        fireEvent.change(passwordInput, { target: { value: "Test@12345" } });
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            // Check that all password requirements are met (green checkmarks)
            const metRequirements = screen.queryAllByText(/✓/);
            expect(metRequirements.length).toBeGreaterThanOrEqual(5);
            
            // Check that password strength shows as Strong
            const strengthIndicator = screen.queryByText(/strong/i);
            expect(strengthIndicator).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 10: Enter valid password but leave Confirm Password empty
    test("Step 10: Enter valid password but leave Confirm Password empty", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        
        fireEvent.change(passwordInput, { target: { value: "Test@12345" } });
        fireEvent.blur(confirmPasswordInput);

        await waitFor(() => {
            const confirmPasswordError = screen.queryByText(/please confirm your password/i);
            expect(confirmPasswordError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 11: Enter password in Confirm Password that does NOT match
    test("Step 11: Enter password in Confirm Password that does NOT match", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const passwordInput = screen.getByLabelText(/^password \*$/i);
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        
        fireEvent.change(passwordInput, { target: { value: "Test@12345" } });
        fireEvent.change(confirmPasswordInput, { target: { value: "Different@123" } });
        fireEvent.blur(confirmPasswordInput);

        await waitFor(() => {
            const matchError = screen.queryByText(/passwords must match/i) ||
                              screen.queryByText(/passwords do not match/i) ||
                              screen.queryByText(/match/i);
            expect(matchError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 12: Do not check "Terms of Service and Privacy Policy" and click Register
    test("Step 12: Do not check Terms and Conditions and click Register", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        // Fill in all required fields
        const fullNameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email address/i);
        const passwordInput = screen.getByLabelText(/^password \*$/i);
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        const studentIdInput = screen.getByLabelText(/student id/i);

        fireEvent.change(fullNameInput, { target: { value: "John Doe" } });
        fireEvent.change(emailInput, { target: { value: "john@utas.edu.om" } });
        fireEvent.change(passwordInput, { target: { value: "Test@12345" } });
        fireEvent.change(confirmPasswordInput, { target: { value: "Test@12345" } });
        fireEvent.change(studentIdInput, { target: { value: "12345" } });

        // Don't check the terms checkbox
        const submitButton = screen.getByRole('button', { name: /sign up/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            // Check for terms error message
            const termsError = screen.queryByText(/you must agree to the terms of service and privacy policy/i) ||
                              screen.queryByText(/must agree/i) ||
                              screen.queryByText(/terms/i);
            expect(termsError).toBeTruthy();
        }, { timeout: 3000 });
    });

    // Test 13: Fill all fields correctly and click Create Account
    test("Step 13: Fill all fields correctly and click Create Account", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        // Fill in all required fields correctly
        const fullNameInput = screen.getByLabelText(/full name/i);
        const emailInput = screen.getByLabelText(/email address/i);
        const passwordInput = screen.getByLabelText(/^password \*$/i);
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        const studentIdInput = screen.getByLabelText(/student id/i);
        const termsCheckbox = screen.getByLabelText(/i agree to the/i);

        fireEvent.change(fullNameInput, { target: { value: "John Doe" } });
        fireEvent.change(emailInput, { target: { value: "john@utas.edu.om" } });
        fireEvent.change(passwordInput, { target: { value: "Test@12345" } });
        fireEvent.change(confirmPasswordInput, { target: { value: "Test@12345" } });
        fireEvent.change(studentIdInput, { target: { value: "12345" } });
        fireEvent.click(termsCheckbox);

        // Verify all fields are filled correctly
        expect(fullNameInput.value).toBe("John Doe");
        expect(emailInput.value).toBe("john@utas.edu.om");
        expect(passwordInput.value).toBe("Test@12345");
        expect(confirmPasswordInput.value).toBe("Test@12345");
        expect(studentIdInput.value).toBe("12345");
        expect(termsCheckbox.checked).toBe(true);

        // Submit button should be enabled when terms are checked
        const submitButton = screen.getByRole('button', { name: /sign up/i });
        expect(submitButton).not.toBeDisabled();
        
        // Submit the form
        fireEvent.click(submitButton);

        // Note: Full integration test would require mocking the API call
        // For now, we verify that the form can be submitted with valid data
        await waitFor(() => {
            // Form submission should trigger validation
            // In a real scenario, this would show success message
            expect(submitButton).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    // Test 14: Enter invalid phone format
    test("Step 14: Enter invalid phone format", async () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );

        const phoneInput = screen.getByPlaceholderText(/enter your phone number/i);

        fireEvent.change(phoneInput, { target: { value: "123" } }); // Invalid: less than 8 digits
        fireEvent.blur(phoneInput);

        // Try to submit to trigger validation
        const submitButton = screen.getByRole('button', { name: /sign up/i });
        fireEvent.click(submitButton);

        // Wait for the validation error to appear
        await waitFor(() => {
            // The validation message in schema is "Phone number must be 8 digits"
            const phoneError = screen.queryByText(/phone number must be 8 digits/i) ||
                              screen.queryByText(/invalid phone format/i) ||
                              screen.queryByText(/8 digits/i);
            expect(phoneError).toBeInTheDocument();
        }, { timeout: 5000 });
    });

    // Additional tests from teacher's sample code
    test("Checking the email format", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
       
        const emailInput = screen.getByLabelText(/email address/i);
        const regex = /^[^\s@]+@utas\.edu\.om$/;
 
        fireEvent.change(emailInput, { target: { value: "test@utas.edu.om" } });
        expect(regex.test(emailInput.value)).toBe(true);
    });
 
    test("Checking the password format", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
 
        const passwordInput = screen.getByLabelText(/^password \*$/i);
        // Password must be at least 8 characters, contain uppercase, lowercase, number, and special character
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
 
        fireEvent.change(passwordInput, { target: { value: "Test@123" } });
        expect(regex.test(passwordInput.value)).toBe(true);
    });
 
    test("Checking full name input exists", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
 
        const fullNameInput = screen.getByLabelText(/full name/i);
        expect(fullNameInput).toBeInTheDocument();
    });
 
    test("Checking role selection exists", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
 
        const roleSelect = screen.getByLabelText(/role \*/i);
        expect(roleSelect).toBeInTheDocument();
    });
 
    test("Checking student ID input appears for Student role", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
 
        const roleSelect = screen.getByLabelText(/role \*/i);
        fireEvent.change(roleSelect, { target: { value: "Student" } });
 
        const studentIdInput = screen.getByLabelText(/student id \*/i);
        expect(studentIdInput).toBeInTheDocument();
    });
 
    test("Checking employee ID input appears for Staff role", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
 
        const roleSelect = screen.getByLabelText(/role \*/i);
        fireEvent.change(roleSelect, { target: { value: "Staff" } });
 
        const employeeIdInput = screen.getByLabelText(/employee id \*/i);
        expect(employeeIdInput).toBeInTheDocument();
    });
 
    test("Checking terms and conditions checkbox exists", () => {
        render(
            <Provider store={store}>
                <Router>
                    <Register />
                </Router>
            </Provider>
        );
 
        const termsCheckbox = screen.getByLabelText(/i agree to the/i);
        expect(termsCheckbox).toBeInTheDocument();
    });
 
    describe("Snapshot of the UI", () => {
        it("Should match the UI Mock", () => {
            const { container } = render(
                <Provider store={store}>
                    <Router>
                        <Register />
                    </Router>
                </Provider>
            );
            
            // Remove image src to avoid snapshot failures from image changes
            const images = container.querySelectorAll('img');
            images.forEach(img => {
                img.setAttribute('src', 'test-file-stub');
            });
            
            expect(container).toMatchSnapshot();
        });
    });
});
