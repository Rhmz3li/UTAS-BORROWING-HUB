import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import axios from 'axios';
import { toast } from 'react-toastify';
import Resources from '../Resources';
import { addBorrowing } from '../../redux/reducers/borrowingReducer';

const mockDrillResource = {
    _id: 'drill-001',
    name: 'Drill',
    description: 'Physics lab equipment',
    category: 'Physics',
    available_quantity: 5,
    max_borrow_days: 3,
    location: 'ENG',
    condition: 'Good',
    status: 'Available',
    requires_payment: true,
    payment_amount: 3,
    department: ''
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn((key) => (key === 'token' ? 'mock-token' : null)),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
global.localStorage = localStorageMock;

jest.mock('axios', () => {
    const mockAxios = {
        get: jest.fn(() => Promise.resolve({
            data: { success: true, data: [mockDrillResource] }
        })),
        post: jest.fn(() => Promise.resolve({
            data: { success: true, message: 'Borrow request submitted' }
        }))
    };
    return { __esModule: true, default: mockAxios };
});

jest.mock('react-toastify', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warning: jest.fn()
    }
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

jest.mock('../../redux/reducers/deviceReducer', () => ({
    fetchDevices: jest.fn(() => ({ type: 'MOCK_FETCH_DEVICES' }))
}));

jest.mock('../../redux/reducers/borrowingReducer', () => ({
    addBorrowing: jest.fn()
}));

jest.mock('../../redux/reducers/reservationReducer', () => ({
    addReservation: jest.fn(() => ({ type: 'MOCK_ADD_RESERVATION' }))
}));

const thunkMiddleware = (store) => (next) => (action) => {
    if (typeof action === 'function') {
        return action(store.dispatch, store.getState);
    }
    return next(action);
};

const mockStore = configureStore([thunkMiddleware]);

const createMockStoreWithResources = (resources = [mockDrillResource], userData = {}) => {
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
            isLoading: false
        },
        devices: {
            devices: resources,
            isLoading: false
        },
        reservations: {
            reservations: [],
            isLoading: false
        },
        borrowing: {
            borrowings: [],
            isLoading: false
        }
    });
};

const renderResources = (store = createMockStoreWithResources()) => {
    return render(
        <Provider store={store}>
            <Router>
                <Resources />
            </Router>
        </Provider>
    );
};

const getBorrowModal = () => {
    const dueDateInput = screen.getByLabelText(/due date/i);
    const modal = dueDateInput.closest('.modal');
    if (!modal) {
        throw new Error('Borrow modal not found');
    }
    return modal;
};

const openBorrowModal = async () => {
    const borrowButton = await screen.findByRole('button', { name: /^borrow$/i });
    fireEvent.click(borrowButton);
    await waitFor(() => {
        expect(screen.getByRole('heading', { name: /borrow resource/i })).toBeInTheDocument();
    });
    return getBorrowModal();
};

const isBorrowModalOpen = () => Boolean(screen.queryByLabelText(/due date/i));

const getPaymentMethodSelect = (modal) => {
    const depositSection = within(modal).getByText(/security deposit/i).closest('motion-div') ||
        within(modal).getByText(/security deposit/i).parentElement;
    const select = depositSection?.querySelector('select') ||
        within(modal).getAllByRole('combobox')[0];
    return select;
};

describe('Borrow Resource Modal - Automated Testing Suite', () => {
    let store;

    beforeEach(() => {
        store = createMockStoreWithResources();
        mockNavigate.mockClear();
        toast.success.mockClear();
        toast.error.mockClear();
        toast.info.mockClear();
        toast.warning.mockClear();
        axios.get.mockClear();
        axios.post.mockClear();
        addBorrowing.mockClear();

        axios.get.mockImplementation(() => Promise.resolve({
            data: { success: true, data: [mockDrillResource] }
        }));

        addBorrowing.mockImplementation(() => (dispatch) => {
            const promise = Promise.resolve({ data: { success: true } });
            promise.unwrap = () => promise;
            return promise;
        });

        localStorageMock.getItem.mockImplementation((key) =>
            (key === 'token' ? 'mock-token' : null)
        );
    });

    test('Test 1: Resources page loads and shows Drill resource', async () => {
        renderResources(store);

        await waitFor(() => {
            expect(screen.getByText('Drill')).toBeInTheDocument();
        }, { timeout: 3000 });

        expect(screen.getByRole('button', { name: /^borrow$/i })).toBeInTheDocument();
    });

    test('Test 2: Click Borrow opens Borrow Resource modal', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        expect(within(modal).getByRole('heading', { name: /borrow resource/i })).toBeInTheDocument();
        expect(within(modal).getByText('Drill')).toBeInTheDocument();
    });

    test('Test 3: Modal displays resource metadata badges', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        expect(within(modal).getByText('Physics')).toBeInTheDocument();
        expect(within(modal).getByText(/5 available/i)).toBeInTheDocument();
        expect(within(modal).getByText(/max 3 days/i)).toBeInTheDocument();
    });

    test('Test 4: Modal displays pickup location', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        expect(within(modal).getByText(/pickup location/i)).toBeInTheDocument();
        expect(within(modal).getByText('ENG')).toBeInTheDocument();
    });

    test('Test 5: Modal displays borrow policy warning', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        expect(within(modal).getByText(/borrow policy & penalties/i)).toBeInTheDocument();
        expect(within(modal).getAllByText(/late return, damage, or loss/i).length).toBeGreaterThan(0);
    });

    test('Test 6: Due date field exists and is pre-filled', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const dueDateInput = within(modal).getByLabelText(/due date/i);
        expect(dueDateInput).toBeInTheDocument();
        expect(dueDateInput).toHaveAttribute('type', 'date');
        expect(dueDateInput.value).toBeTruthy();
    });

    test('Test 7: Security deposit section shows 3.00 OMR', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        expect(within(modal).getByText(/security deposit \(refundable\)/i)).toBeInTheDocument();
        expect(within(modal).getByText(/3\.00 OMR/i)).toBeInTheDocument();
    });

    test('Test 8: Payment method dropdown has Cash and Card options', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const paymentSelect = getPaymentMethodSelect(modal);
        const options = Array.from(paymentSelect.options).map((opt) => opt.value);

        expect(options).toEqual(expect.arrayContaining(['', 'Cash', 'Card']));
    });

    test('Test 9: Condition on borrow is Good and read-only', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const conditionInput = within(modal).getByDisplayValue('Good');
        expect(conditionInput).toBeInTheDocument();
        expect(conditionInput).toBeDisabled();
        expect(within(modal).getByText(/automatically set from the resource/i)).toBeInTheDocument();
    });

    test('Test 10: Terms checkbox is unchecked by default', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const termsCheckbox = within(modal).getByRole('checkbox', {
            name: /terms and conditions/i
        });
        expect(termsCheckbox).not.toBeChecked();
    });

    test('Test 11: Submit without accepting terms shows error toast', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const paymentSelect = getPaymentMethodSelect(modal);
        fireEvent.change(paymentSelect, { target: { value: 'Cash' } });

        fireEvent.click(within(modal).getByRole('button', { name: /confirm borrow/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                'Please accept the terms and conditions to proceed'
            );
        });
        expect(addBorrowing).not.toHaveBeenCalled();
    });

    test('Test 12: Submit without payment method shows error toast', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const termsCheckbox = within(modal).getByRole('checkbox', {
            name: /terms and conditions/i
        });
        fireEvent.click(termsCheckbox);

        fireEvent.click(within(modal).getByRole('button', { name: /confirm borrow/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                'Please select a payment method for the security deposit'
            );
        });
        expect(addBorrowing).not.toHaveBeenCalled();
    });

    test('Test 13: Change due date updates the field', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const dueDateInput = within(modal).getByLabelText(/due date/i);
        fireEvent.change(dueDateInput, { target: { value: '2026-05-20' } });

        expect(dueDateInput.value).toBe('2026-05-20');
    });

    test('Test 14: Select payment method Cash', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const paymentSelect = getPaymentMethodSelect(modal);
        fireEvent.change(paymentSelect, { target: { value: 'Cash' } });

        expect(paymentSelect.value).toBe('Cash');
    });

    test('Test 15: Successful borrow with valid form shows success toast', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const paymentSelect = getPaymentMethodSelect(modal);
        fireEvent.change(paymentSelect, { target: { value: 'Cash' } });
        fireEvent.click(within(modal).getByRole('checkbox', { name: /terms and conditions/i }));
        fireEvent.click(within(modal).getByRole('button', { name: /confirm borrow/i }));

        await waitFor(() => {
            expect(addBorrowing).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Borrow request submitted successfully'),
                expect.any(Object)
            );
        });

        await waitFor(() => {
            expect(isBorrowModalOpen()).toBe(false);
        });
    });

    test('Test 16: Cancel closes borrow modal', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        fireEvent.click(within(modal).getByRole('button', { name: /^cancel$/i }));

        await waitFor(() => {
            expect(isBorrowModalOpen()).toBe(false);
        });
    });

    test('Test 17: Close borrow modal using header close button', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        fireEvent.click(within(modal).getByRole('button', { name: /close/i }));

        await waitFor(() => {
            expect(isBorrowModalOpen()).toBe(false);
        });
    });

    test('Test 18: Failed borrow submission shows error toast', async () => {
        addBorrowing.mockImplementation(() => () => {
            const promise = Promise.reject({ payload: 'Borrow limit reached' });
            promise.unwrap = () => promise;
            return promise;
        });

        renderResources(store);
        const modal = await openBorrowModal();

        fireEvent.change(getPaymentMethodSelect(modal), { target: { value: 'Card' } });
        fireEvent.click(within(modal).getByRole('checkbox', { name: /terms and conditions/i }));
        fireEvent.click(within(modal).getByRole('button', { name: /confirm borrow/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Borrow limit reached');
        });
    });

    test('Test 19: addBorrowing called with correct payload for Cash deposit', async () => {
        renderResources(store);
        const modal = await openBorrowModal();

        const dueDateInput = within(modal).getByLabelText(/due date/i);
        fireEvent.change(dueDateInput, { target: { value: '2026-05-20' } });
        fireEvent.change(getPaymentMethodSelect(modal), { target: { value: 'Cash' } });
        fireEvent.click(within(modal).getByRole('checkbox', { name: /terms and conditions/i }));
        fireEvent.click(within(modal).getByRole('button', { name: /confirm borrow/i }));

        await waitFor(() => {
            expect(addBorrowing).toHaveBeenCalledWith(
                expect.objectContaining({
                    deviceId: 'drill-001',
                    returnDate: '2026-05-20',
                    conditionBefore: 'Good',
                    paymentMethod: 'Cash',
                    paymentAmount: 3
                })
            );
        });
    });

    test('Test 20: Confirm Borrow button shows Processing while submitting', async () => {
        let resolveBorrow;
        addBorrowing.mockImplementation(() => () => {
            const promise = new Promise((resolve) => {
                resolveBorrow = resolve;
            });
            promise.unwrap = () => promise;
            return promise;
        });

        renderResources(store);
        const modal = await openBorrowModal();

        fireEvent.change(getPaymentMethodSelect(modal), { target: { value: 'Cash' } });
        fireEvent.click(within(modal).getByRole('checkbox', { name: /terms and conditions/i }));
        fireEvent.click(within(modal).getByRole('button', { name: /confirm borrow/i }));

        await waitFor(() => {
            expect(within(modal).getByRole('button', { name: /processing/i })).toBeInTheDocument();
        });

        resolveBorrow({ data: { success: true } });
    });
});
