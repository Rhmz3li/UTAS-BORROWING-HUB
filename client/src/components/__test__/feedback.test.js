import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import axios from 'axios';
import { toast } from 'react-toastify';
import Home from '../HomePage';
import { ThemeProvider } from '../../contexts/ThemeContext.jsx';

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn((key) => {
        if (key === 'token') return 'mock-token';
        if (key === 'hasSeenWelcome') return 'true';
        if (key === 'theme') return 'light';
        return null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock axios for API calls
jest.mock('axios', () => {
    const mockAxios = {
        get: jest.fn(() => Promise.resolve({
            data: { success: true, data: [], meta: null }
        })),
        post: jest.fn(() => Promise.resolve({
            data: { success: true, message: 'Feedback submitted successfully' }
        }))
    };
    return {
        __esModule: true,
        default: mockAxios
    };
});

// Mock toast notifications
jest.mock('react-toastify', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warning: jest.fn()
    }
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

const mockStore = configureStore([]);

const createMockStoreWithUser = (userData = {}) => {
    return mockStore({
        auth: {
            user: {
                id: 1,
                full_name: 'Riham',
                email: 'riham@utas.edu.om',
                department: 'College of Information Technology',
                role: 'Student',
                ...userData
            },
            token: 'mock-token',
            isLoading: false,
            isSuccess: false,
            isError: false,
            errorMessage: null
        },
        borrowing: {
            borrowings: [],
            isLoading: false
        },
        reservations: {
            reservations: [],
            isLoading: false
        },
        notifications: {
            notifications: [],
            isLoading: false
        },
        devices: {
            devices: [],
            isLoading: false
        }
    });
};

const renderHome = (store = createMockStoreWithUser()) => {
    return render(
        <Provider store={store}>
            <ThemeProvider>
                <Router>
                    <Home />
                </Router>
            </ThemeProvider>
        </Provider>
    );
};

const getFeedbackModal = () => {
    const reviewField = screen.getByLabelText(/your review/i);
    const modal = reviewField.closest('.modal');
    if (!modal) {
        throw new Error('Feedback modal not found');
    }
    return modal;
};

const openFeedbackModal = async () => {
    const openButton = await screen.findByRole('button', { name: /add your review/i });
    fireEvent.click(openButton);
    await waitFor(() => {
        expect(screen.getByLabelText(/your review/i)).toBeInTheDocument();
    });
    return getFeedbackModal();
};

const isFeedbackModalOpen = () => Boolean(screen.queryByLabelText(/your review/i));

const getFeedbackStars = (modal) => {
    const ratingLabel = within(modal).getByText('Rating *');
    const formGroup = ratingLabel.closest('.mb-3') || ratingLabel.parentElement;
    return formGroup.querySelectorAll('svg');
};

const clickStarRating = (modal, starIndex) => {
    const stars = getFeedbackStars(modal);
    fireEvent.click(stars[starIndex]);
};

describe('Feedback Modal - Automated Testing Suite', () => {
    let store;

    beforeEach(() => {
        store = createMockStoreWithUser();
        mockNavigate.mockClear();
        toast.success.mockClear();
        toast.error.mockClear();
        toast.info.mockClear();
        toast.warning.mockClear();
        axios.get.mockClear();
        axios.post.mockClear();
        axios.get.mockImplementation(() => Promise.resolve({
            data: { success: true, data: [], meta: null }
        }));
        axios.post.mockImplementation(() => Promise.resolve({
            data: { success: true, message: 'Feedback submitted successfully' }
        }));
        localStorageMock.getItem.mockImplementation((key) => {
            if (key === 'token') return 'mock-token';
            if (key === 'hasSeenWelcome') return 'true';
            if (key === 'theme') return 'light';
            return null;
        });
    });

    // Test 1: Home page loads with feedback button
    test('Test 1: Home page loads and shows Add Your Review button', async () => {
        renderHome(store);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /add your review/i })).toBeInTheDocument();
        }, { timeout: 3000 });

        expect(screen.getByText(/welcome back, riham/i)).toBeInTheDocument();
    });

    // Test 2: Open feedback modal
    test('Test 2: Click Add Your Review and open feedback modal', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        expect(within(modal).getByText('Rating *')).toBeInTheDocument();
        expect(within(modal).getByLabelText(/category/i)).toBeInTheDocument();
        expect(within(modal).getByLabelText(/your review/i)).toBeInTheDocument();
    });

    // Test 3: Modal title
    test('Test 3: Feedback modal displays correct title', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        expect(within(modal).getByRole('heading', { name: /add your review/i })).toBeInTheDocument();
    });

    // Test 4: Category dropdown default value
    test('Test 4: Category dropdown defaults to Other', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const categorySelect = within(modal).getByLabelText(/category/i);
        expect(categorySelect).toBeInTheDocument();
        expect(categorySelect.value).toBe('Other');
    });

    // Test 5: Review textarea placeholder
    test('Test 5: Review textarea shows correct placeholder', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const reviewInput = within(modal).getByPlaceholderText(
            /share your experience with utas borrowing hub/i
        );
        expect(reviewInput).toBeInTheDocument();
        expect(reviewInput).toHaveAttribute('id', 'feedbackComment');
    });

    // Test 6: Submit button disabled when review is empty
    test('Test 6: Submit Review button is disabled when review is empty', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const submitButton = within(modal).getByRole('button', { name: /submit review/i });
        expect(submitButton).toBeDisabled();
    });

    // Test 7: Submit enabled after entering review
    test('Test 7: Submit Review button enables after entering review text', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const reviewInput = within(modal).getByLabelText(/your review/i);
        fireEvent.change(reviewInput, { target: { value: 'Excellent borrowing experience!' } });

        const submitButton = within(modal).getByRole('button', { name: /submit review/i });
        expect(submitButton).not.toBeDisabled();
        expect(reviewInput.value).toBe('Excellent borrowing experience!');
    });

    // Test 8: Change category
    test('Test 8: Change category selection to Service', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const categorySelect = within(modal).getByLabelText(/category/i);
        fireEvent.change(categorySelect, { target: { value: 'Service' } });

        expect(categorySelect.value).toBe('Service');
    });

    // Test 9: Change rating via stars (default is 5 — verify 4th and 5th stars dim after 3-star click)
    test('Test 9: Change rating by clicking stars updates star display', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const stars = getFeedbackStars(modal);
        expect(stars.length).toBe(5);
        expect(stars[4]).toHaveStyle({ color: 'rgb(255, 193, 7)' }); // all filled at default 5

        clickStarRating(modal, 2); // 3-star rating

        await waitFor(() => {
            expect(stars[3]).toHaveStyle({ color: 'rgb(221, 221, 221)' });
            expect(stars[4]).toHaveStyle({ color: 'rgb(221, 221, 221)' });
        });
    });

    // Test 10: Clear review disables submit again
    test('Test 10: Clear review text and verify submit is disabled again', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const reviewInput = within(modal).getByLabelText(/your review/i);
        fireEvent.change(reviewInput, { target: { value: 'Temporary review' } });
        fireEvent.change(reviewInput, { target: { value: '' } });

        const submitButton = within(modal).getByRole('button', { name: /submit review/i });
        expect(submitButton).toBeDisabled();
        expect(reviewInput.value).toBe('');
    });

    // Test 11: Successful feedback submission
    test('Test 11: Submit valid feedback and show success toast', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const reviewInput = within(modal).getByLabelText(/your review/i);
        fireEvent.change(reviewInput, { target: { value: 'UTAS Borrowing Hub is very helpful!' } });

        const submitButton = within(modal).getByRole('button', { name: /submit review/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith('Thank you for your feedback!');
        });

        await waitFor(() => {
            expect(isFeedbackModalOpen()).toBe(false);
        });
    });

    // Test 12: Cancel closes modal
    test('Test 12: Click Cancel and close feedback modal', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const cancelButton = within(modal).getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(isFeedbackModalOpen()).toBe(false);
        });
    });

    // Test 13: Close modal via header close button
    test('Test 13: Close feedback modal using header close button', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const closeButton = within(modal).getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        await waitFor(() => {
            expect(isFeedbackModalOpen()).toBe(false);
        });
    });

    // Test 14: Failed submission shows error toast
    test('Test 14: Failed feedback submission shows error toast', async () => {
        axios.post.mockImplementationOnce(() => Promise.reject({
            response: { data: { message: 'Server error' } }
        }));

        renderHome(store);
        const modal = await openFeedbackModal();

        const reviewInput = within(modal).getByLabelText(/your review/i);
        fireEvent.change(reviewInput, { target: { value: 'Test feedback' } });

        fireEvent.click(within(modal).getByRole('button', { name: /submit review/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Server error');
        });
    });

    // Test 15: All category options available
    test('Test 15: Category dropdown contains all options', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const categorySelect = within(modal).getByLabelText(/category/i);
        const options = Array.from(categorySelect.options).map((opt) => opt.value);

        expect(options).toEqual(expect.arrayContaining(['Service', 'Resource', 'System', 'Other']));
    });

    // Test 16: Submit with Resource category
    test('Test 16: Submit feedback with Resource category', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        fireEvent.change(within(modal).getByLabelText(/category/i), { target: { value: 'Resource' } });
        fireEvent.change(within(modal).getByLabelText(/your review/i), {
            target: { value: 'Resources are well maintained.' }
        });
        fireEvent.click(within(modal).getByRole('button', { name: /submit review/i }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:5000/feedback',
                expect.objectContaining({
                    rating: 5,
                    comment: 'Resources are well maintained.',
                    category: 'Resource'
                }),
                expect.any(Object)
            );
        });
    });

    // Test 17: Empty review does not call API
    test('Test 17: Empty review does not submit to API', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const submitButton = within(modal).getByRole('button', { name: /submit review/i });
        expect(submitButton).toBeDisabled();
        fireEvent.click(submitButton);

        expect(axios.post).not.toHaveBeenCalled();
    });

    // Test 18: Reopen modal after cancel resets empty review
    test('Test 18: Reopen modal after cancel shows empty review field', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        fireEvent.change(within(modal).getByLabelText(/your review/i), {
            target: { value: 'Unsaved review text' }
        });
        fireEvent.click(within(modal).getByRole('button', { name: /cancel/i }));

        await waitFor(() => {
            expect(isFeedbackModalOpen()).toBe(false);
        });

        await openFeedbackModal();
        const reviewInput = within(getFeedbackModal()).getByLabelText(/your review/i);
        expect(reviewInput.value).toBe('');
    });

    // Test 19: Five-star default rating on submit
    test('Test 19: Default 5-star rating is sent when stars are not changed', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        fireEvent.change(within(modal).getByLabelText(/your review/i), {
            target: { value: 'Five stars by default.' }
        });
        fireEvent.click(within(modal).getByRole('button', { name: /submit review/i }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:5000/feedback',
                expect.objectContaining({ rating: 5 }),
                expect.any(Object)
            );
        });
    });

    // Test 20: Whitespace-only review keeps submit disabled
    test('Test 20: Whitespace-only review keeps submit button disabled', async () => {
        renderHome(store);
        const modal = await openFeedbackModal();

        const reviewInput = within(modal).getByLabelText(/your review/i);
        fireEvent.change(reviewInput, { target: { value: '   ' } });

        const submitButton = within(modal).getByRole('button', { name: /submit review/i });
        expect(submitButton).toBeDisabled();
    });
});
