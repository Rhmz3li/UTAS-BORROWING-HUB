import { Container, Row, Col } from "reactstrap";

const Footer = () => {
    return (
        <footer className="bg-dark text-white mt-5 py-4">
            <Container>
                <Row>
                    <Col md={6}>
                        <h5>UTAS Borrowing Hub</h5>
                        <p className="text-muted">Resource Management System</p>
                    </Col>
                    <Col md={6} className="text-end">
                        <p className="text-muted mb-0">&copy; 2025 UTAS. All rights reserved.</p>
                    </Col>
                </Row>
            </Container>
        </footer>
    );
};

export default Footer;

