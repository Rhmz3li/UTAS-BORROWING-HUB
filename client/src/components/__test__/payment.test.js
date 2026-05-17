import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import axios from 'axios';
import { toast } from 'react-toastify';
import Payments from '../PaymentPage';

const MOCK_TRANSACTION_ID = 'UBH-669d491c-b61e-4330-b582-6a2b51a54e19';

const mockPendingCardPayment = {
    _id: 'payment-001',
    amount: 5.2,
    payment_method: 'Card',
    status: 'Pending',
    payment_type: 'Resource',
    notes: 'Payment for borrowing Dell Latitude 7420 Laptop',
    created_at: '2026-05-18T10:00:00.000Z',
    transaction_id: null
};

const mockPendingCashPayment = {
    _id: 'payment-cash-001',
    amount: 3,
    payment_method: 'Cash',
    status: 'Pending',
    payment_type: 'Resource',
    notes: 'Cash deposit for drill',
    created_at: '2026-05-18T11:00:00.000Z'
};

const localStorageMock = {
    getItem: jest.fn((key) => (key === 'token' ? 'mock-token' : null)),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
global.localStorage = localStorageMock;

jest.mock('../../utils/generateClientTransactionId', () => ({
    generateClientTransactionId: () => MOCK_TRANSACTION_ID
}));

jest.mock('axios', () => {
    const mockAxios = {
        get: jest.fn(() => Promise.resolve({
            data: { success: true, data: [mockPendingCardPayment] }
        })),
        post: jest.fn(() => Promise.resolve({
            data: { success: true, usageCount: 0, message: 'Payment completed' }
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
    useLocation: () => ({ pathname: '/payments', state: {} })
}));

const mockStore = configureStore([]);

const createMockStore = (userData = {}) => mockStore({
    auth: {
        user: {
            id: 1,
            full_name: 'Riham',
            email: 'riham@utas.edu.om',
            role: 'Student',
            ...userData
        },
        token: 'mock-token',
        isLoading: false
    }
});

const renderPayments = (store = createMockStore(), payments = [mockPendingCardPayment]) => {
    axios.get.mockImplementation(() => Promise.resolve({
        data: { success: true, data: payments }
    }));
    return render(
        <Provider store={store}>
            <Router>
                <Payments />
            </Router>
        </Provider>
    );
};

const getPayModal = () => {
    const amountLabel = screen.getByText(/amount due/i);
    const modal = amountLabel.closest('.modal');
    if (!modal) {
        throw new Error('Pay modal not found');
    }
    return modal;
};

const openPayModal = async () => {
    const payButton = await screen.findByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);
    await waitFor(() => {
        expect(screen.getByText(MOCK_TRANSACTION_ID)).toBeInTheDocument();
    });
    return getPayModal();
};

const isPayModalOpen = () => Boolean(screen.queryByText(MOCK_TRANSACTION_ID));

const selectCardNetwork = (modal, network) => {
    fireEvent.click(within(modal).getByRole('button', { name: network }));
};

const fillValidVisaPaymentForm = (modal) => {
    localStorageMock.getItem.mockImplementation((key) =>
        (key === 'token' ? 'mock-token' : null)
    );
    selectCardNetwork(modal, 'Visa');
    fireEvent.change(
        within(modal).getByPlaceholderText(/16 digits starting with 4/i),
        { target: { value: '4123456789012345' } }
    );
    fireEvent.change(
        within(modal).getByPlaceholderText(/name on card/i),
        { target: { value: 'Riham Ali' } }
    );
    fireEvent.change(
        within(modal).getByPlaceholderText('MM/YY'),
        { target: { value: '12/30' } }
    );
    fireEvent.change(
        within(modal).getByPlaceholderText('•••'),
        { target: { value: '123' } }
    );
};

describe('Pay Security Deposit Modal - Automated Testing Suite', () => {
    let store;

    beforeEach(() => {
        global.localStorage = localStorageMock;
        store = createMockStore();
        mockNavigate.mockClear();
        toast.success.mockClear();
        toast.error.mockClear();
        toast.info.mockClear();
        toast.warning.mockClear();
        axios.get.mockClear();
        axios.post.mockClear();

        axios.get.mockImplementation(() => Promise.resolve({
            data: { success: true, data: [mockPendingCardPayment] }
        }));
        axios.post.mockImplementation((url) => {
            if (url.includes('check-card-usage')) {
                return Promise.resolve({ data: { usageCount: 0 } });
            }
            return Promise.resolve({
                data: { success: true, message: 'Payment completed successfully' }
            });
        });

        localStorageMock.getItem.mockImplementation((key) =>
            (key === 'token' ? 'mock-token' : null)
        );
    });

    test('Test 1: Payments page loads and shows pending payment', async () => {
        renderPayments(store);

        await waitFor(() => {
            expect(screen.getByText(/my payments/i)).toBeInTheDocument();
            expect(screen.getAllByText(/5\.20/).length).toBeGreaterThan(0);
            expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
        });
    });

    test('Test 2: Click Pay Now opens Pay Security Deposit modal', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        expect(within(modal).getByText(/pay security deposit/i)).toBeInTheDocument();
    });

    test('Test 3: Modal displays amount due 5.20 OMR', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        expect(within(modal).getByText(/5\.20/)).toBeInTheDocument();
        expect(within(modal).getByText('OMR')).toBeInTheDocument();
    });

    test('Test 4: Modal displays payment description', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        expect(within(modal).getByText(/payment for borrowing dell latitude 7420 laptop/i)).toBeInTheDocument();
    });

    test('Test 5: Modal displays auto-generated transaction reference', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        expect(within(modal).getByText(MOCK_TRANSACTION_ID)).toBeInTheDocument();
        expect(within(modal).getByText(/auto-generated by the system/i)).toBeInTheDocument();
    });

    test('Test 6: Card type Visa and Mastercard options are shown', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        expect(within(modal).getByRole('button', { name: 'Visa' })).toBeInTheDocument();
        expect(within(modal).getByRole('button', { name: 'Mastercard' })).toBeInTheDocument();
    });

    test('Test 7: Card form fields are present', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        expect(within(modal).getByPlaceholderText(/16 digits starting with 4/i)).toBeInTheDocument();
        expect(within(modal).getByPlaceholderText(/name on card/i)).toBeInTheDocument();
        expect(within(modal).getByPlaceholderText('MM/YY')).toBeInTheDocument();
        expect(within(modal).getByPlaceholderText('•••')).toBeInTheDocument();
    });

    test('Test 8: Selecting Mastercard updates card number placeholder', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        selectCardNetwork(modal, 'Mastercard');

        expect(within(modal).getByPlaceholderText(/16 digits starting with 55/i)).toBeInTheDocument();
    });

    test('Test 9: Submit without card type shows error toast', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        fireEvent.click(within(modal).getByRole('button', { name: /pay now/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Please select your card type');
        });
    });

    test('Test 10: Submit without card holder name shows error toast', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        selectCardNetwork(modal, 'Visa');
        fireEvent.click(within(modal).getByRole('button', { name: /pay now/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/card holder/i)
            );
        });
    });

    test('Test 11: Invalid card number shows error toast', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        selectCardNetwork(modal, 'Visa');
        fireEvent.change(
            within(modal).getByPlaceholderText(/16 digits starting with 4/i),
            { target: { value: '1234567890123456' } }
        );
        fireEvent.change(
            within(modal).getByPlaceholderText(/name on card/i),
            { target: { value: 'Riham Ali' } }
        );
        fireEvent.click(within(modal).getByRole('button', { name: /pay now/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
    });

    test('Test 12: Card holder input strips numbers', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        const holderInput = within(modal).getByPlaceholderText(/name on card/i);
        fireEvent.change(holderInput, { target: { value: 'Riham123 Ali' } });

        expect(holderInput.value).not.toMatch(/\d/);
        expect(holderInput.value).toContain('Riham');
    });

    test('Test 13: Successful card payment shows success toast and closes modal', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        fillValidVisaPaymentForm(modal);
        fireEvent.click(within(modal).getByRole('button', { name: /pay now/i }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:5000/payments/payment-001/pay-deposit',
                expect.objectContaining({
                    payment_method: 'Card',
                    transaction_id: MOCK_TRANSACTION_ID,
                    card_details: expect.objectContaining({
                        card_network: 'Visa',
                        card_holder: 'Riham Ali',
                        card_number: '4123456789012345',
                        expiry_date: '12/30',
                        cvv: '123'
                    })
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: expect.stringMatching(/^Bearer /)
                    })
                })
            );
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Payment completed successfully')
            );
        });

        await waitFor(() => {
            expect(isPayModalOpen()).toBe(false);
        });
    });

    test('Test 14: Cancel closes pay modal', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        fireEvent.click(within(modal).getByRole('button', { name: /^cancel$/i }));

        await waitFor(() => {
            expect(isPayModalOpen()).toBe(false);
        });
    });

    test('Test 15: Close button closes pay modal', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        fireEvent.click(within(modal).getByRole('button', { name: /close/i }));

        await waitFor(() => {
            expect(isPayModalOpen()).toBe(false);
        });
    });

    test('Test 16: Failed payment shows error toast', async () => {
        axios.post.mockImplementation((url) => {
            if (url.includes('check-card-usage')) {
                return Promise.resolve({ data: { usageCount: 0 } });
            }
            return Promise.reject({
                response: { data: { message: 'Payment declined by bank' } }
            });
        });

        renderPayments(store);
        const modal = await openPayModal();

        fillValidVisaPaymentForm(modal);
        fireEvent.click(within(modal).getByRole('button', { name: /pay now/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Payment declined by bank');
        });
    });

    test('Test 17: Mastercard selection shows Mastercard badge', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        selectCardNetwork(modal, 'Mastercard');
        fireEvent.change(
            within(modal).getByPlaceholderText(/16 digits starting with 55/i),
            { target: { value: '5523456789012345' } }
        );

        expect(within(modal).getAllByText('Mastercard').length).toBeGreaterThanOrEqual(2);
    });

    test('Test 18: Expiry field formats as MM/YY', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        const expiryInput = within(modal).getByPlaceholderText('MM/YY');
        fireEvent.change(expiryInput, { target: { value: '1230' } });

        expect(expiryInput.value).toBe('12/30');
    });

    test('Test 19: CVV accepts only 3 digits', async () => {
        renderPayments(store);
        const modal = await openPayModal();

        const cvvInput = within(modal).getByPlaceholderText('•••');
        fireEvent.change(cvvInput, { target: { value: '12345' } });

        expect(cvvInput.value).toBe('123');
    });

    test('Test 20: Cash payment shows cash instructions and submit label', async () => {
        renderPayments(store, [mockPendingCashPayment]);

        const submitCashButton = await screen.findByRole('button', { name: /submit cash/i });
        fireEvent.click(submitCashButton);

        await waitFor(() => {
            expect(screen.getByText(/cash payment/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /submit for admin confirmation/i })).toBeInTheDocument();
        });
    });
});
