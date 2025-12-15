import React, { useState } from "react";
import { Container, Row, Col, Card, CardBody, Form, FormGroup, Label, Input, Button } from "reactstrap";
import { FaPlus, FaImage, FaPaperPlane } from 'react-icons/fa';

const NewPost = () => {
    const [postContent, setPostContent] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle post submission
        console.log('Post submitted:', { postContent, selectedImage });
        setPostContent('');
        setSelectedImage(null);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
        }
    };

    return (
        <Card className="border-0 shadow-sm mb-3">
            <CardBody>
                <Form onSubmit={handleSubmit}>
                    <FormGroup>
                        <Input
                            type="textarea"
                            placeholder="What's on your mind?"
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            rows="3"
                            style={{ border: 'none', resize: 'none' }}
                        />
                    </FormGroup>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <Label for="image-upload" className="btn btn-sm btn-outline-secondary me-2" style={{ cursor: 'pointer' }}>
                                <FaImage className="me-1" />
                                Photo
                            </Label>
                            <Input
                                type="file"
                                id="image-upload"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                            />
                            {selectedImage && (
                                <span className="text-muted small">{selectedImage.name}</span>
                            )}
                        </div>
                        <Button type="submit" color="primary" size="sm">
                            <FaPaperPlane className="me-1" />
                            Post
                        </Button>
                    </div>
                </Form>
            </CardBody>
        </Card>
    );
};

export default NewPost;
