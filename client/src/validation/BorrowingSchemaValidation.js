import * as yup from 'yup'

// Legacy schema - keep for backward compatibility
export const checkoutSchema = yup.object().shape({
  resource_id: yup
    .string()
    .required('Resource is required'),
  due_date: yup
    .date()
    .min(new Date(), 'Due date must be in the future')
    .required('Due date is required'),
  condition_on_borrow: yup
    .string()
    .oneOf(['Excellent', 'Good', 'Fair', 'Poor'], 'Invalid condition')
})

// New schema matching the example style
export const BorrowingSchemaValidation = yup.object().shape({
  deviceId: yup
    .string()
    .required('Device is required'),
  userId: yup
    .string()
    .required('User is required'),
  returnDate: yup
    .date()
    .min(new Date(), 'Return date must be in the future')
    .required('Return date is required'),
  conditionBefore: yup
    .string()
    .oneOf(['Excellent', 'Good', 'Fair', 'Poor'], 'Invalid condition')
    .required('Condition before borrowing is required')
})

export const returnSchema = yup.object().shape({
  condition_on_return: yup
    .string()
    .oneOf(['Excellent', 'Good', 'Fair', 'Poor'], 'Invalid condition')
    .required('Condition on return is required'),
  notes: yup.string()
})
