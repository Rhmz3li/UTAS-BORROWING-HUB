import * as yup from 'yup'

export const resourceSchema = yup.object().shape({
  name: yup
    .string()
    .min(3, 'Resource name must be at least 3 characters')
    .required('Resource name is required'),
  description: yup.string(),
  category: yup
    .string()
    .oneOf(['IT', 'Electronics', 'Lab Equipment', 'Books', 'Media', 'Other'], 'Invalid category')
    .required('Category is required'),
  barcode: yup.string(),
  qr_code: yup.string(),
  location: yup.string(),
  condition: yup
    .string()
    .oneOf(['Excellent', 'Good', 'Fair', 'Poor'], 'Invalid condition'),
  max_borrow_days: yup
    .number()
    .min(1, 'Maximum borrow days must be at least 1')
    .required('Maximum borrow days is required'),
  total_quantity: yup
    .number()
    .min(1, 'Total quantity must be at least 1')
    .required('Total quantity is required'),
  available_quantity: yup
    .number()
    .min(0, 'Available quantity cannot be negative')
    .required('Available quantity is required')
})
