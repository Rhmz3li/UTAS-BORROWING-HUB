import * as yup from 'yup';

export const postSchema = yup.object().shape({
    content: yup
        .string()
        .required('Post content is required')
        .min(1, 'Post content cannot be empty')
        .max(5000, 'Post content must be less than 5000 characters'),
    image: yup.mixed().nullable(),
    tags: yup.array().of(yup.string())
});

export const commentSchema = yup.object().shape({
    comment: yup
        .string()
        .required('Comment is required')
        .min(1, 'Comment cannot be empty')
        .max(1000, 'Comment must be less than 1000 characters')
});
