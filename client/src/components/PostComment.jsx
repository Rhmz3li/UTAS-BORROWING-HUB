import React, { useState } from "react";
import { Card, CardBody, Input, Button } from "reactstrap";
import { FaPaperPlane } from 'react-icons/fa';

const PostComment = ({ postId, onCommentSubmit }) => {
    const [comment, setComment] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (comment.trim()) {
            onCommentSubmit(postId, comment);
            setComment('');
        }
    };

    return (
        <Card className="border-0 shadow-sm mt-2">
            <CardBody className="p-2">
                <form onSubmit={handleSubmit} className="d-flex align-items-center gap-2">
                    <Input
                        type="text"
                        placeholder="Write a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        style={{ border: 'none', background: '#f8f9fa' }}
                    />
                    <Button type="submit" color="primary" size="sm">
                        <FaPaperPlane />
                    </Button>
                </form>
            </CardBody>
        </Card>
    );
};

export default PostComment;
