import * as yup from 'yup';

export const UserRegisterSchemaValidation = yup.object().shape({
    email: yup
        .string()
        .required('Email is required')
        .email('Please enter a valid email address')
        .matches(/^[^\s@]+@utas\.edu\.om$/, 'Email must be a valid UTAS email address (@utas.edu.om)'),
    password: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters long')
        .max(128, 'Password must be less than 128 characters')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[0-9]/, 'Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character')
        .test('not-common', 'Password is too common. Please choose a stronger password', (value) => {
            if (!value) return true;
            const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
            return !commonPasswords.some(common => value.toLowerCase().includes(common));
        }),
    full_name: yup.string().required('Full name is required!!!'),
    confirmPassword: yup.string().oneOf([yup.ref('password'), null], 'Passwords must match').required('Please confirm your password'),
    role: yup.string().oneOf(['Student', 'Staff'], 'Invalid role selected'),
    student_id: yup.string().when('role', {
        is: 'Student',
        then: (schema) => schema.required('Student ID is required'),
        otherwise: (schema) => schema.notRequired()
    }),
    employee_id: yup.string().when('role', {
        is: 'Staff',
        then: (schema) => schema.required('Employee ID is required'),
        otherwise: (schema) => schema.notRequired()
    }),
    identification_id: yup.string().when('role', {
        is: (val) => ['Student', 'Staff'].includes(val),
        then: (schema) => schema.required('ID is required'),
        otherwise: (schema) => schema.notRequired()
    }),
    phone: yup.string().matches(/^[0-9]{8}$/, 'Phone number must be 8 digits'),
    department: yup.string()
});

export const loginSchema = yup.object().shape({
    email: yup
        .string()
        .required('Email is required')
        .email('Please enter a valid email address')
        .matches(/^[^\s@]+@utas\.edu\.om$/, 'Email must be a valid UTAS email address (@utas.edu.om)'),
    password: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters')
});

export const registerSchema = UserRegisterSchemaValidation;

export const resetPasswordSchema = yup.object().shape({
    password: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters long')
        .max(128, 'Password must be less than 128 characters')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[0-9]/, 'Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character')
        .test('not-common', 'Password is too common. Please choose a stronger password', (value) => {
            if (!value) return true;
            const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
            return !commonPasswords.some(common => value.toLowerCase().includes(common));
        }),
    confirmPassword: yup
        .string()
        .required('Please confirm your password')
        .oneOf([yup.ref('password'), null], 'Passwords must match')
});
