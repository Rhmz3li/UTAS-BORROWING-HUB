import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  FormText,
} from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addBorrowing } from "../redux/reducers/borrowingReducer";
import { fetchDevices } from "../redux/reducers/deviceReducer";
import { BorrowingSchemaValidation } from "../validation";

const BorrowingForm = ({ isOpen, toggle, device }) => {
  const [returnDate, setReturnDate] = useState("");
  const [conditionBefore, setConditionBefore] = useState("");
  const [errors, setErrors] = useState({});
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setReturnDate("");
      setConditionBefore("");
      setErrors({});
      // Set default condition for non-admin users
      if (user && user.role !== "Admin") {
        setConditionBefore("Excellent");
      }
    }
  }, [isOpen, user]);

  const validationSchema = BorrowingSchemaValidation;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    // Prevent admin from requesting borrowing
    if (user && user.role === "Admin") {
      alert("Admins cannot request to borrow devices.");
      return;
    }
    
    try {
      // For non-admin users, set condition to "Excellent" automatically
      const finalCondition = user && user.role === "Admin" 
        ? conditionBefore 
        : "Excellent";
      
      // Validate with all required fields
      const validationData = {
        deviceId: device._id,
        userId: user._id,
        returnDate: new Date(returnDate),
        conditionBefore: finalCondition,
      };
      
      await validationSchema.validate(validationData, { abortEarly: false });

      const borrowingData = {
        deviceId: device._id,
        userId: user._id,
        returnDate: new Date(returnDate),
        conditionBefore: finalCondition,
      };

      const result = await dispatch(addBorrowing(borrowingData));
      
      if (result.payload && result.payload.message) {
        await dispatch(fetchDevices());
        toggle();
        setReturnDate("");
        setConditionBefore("");
        alert("Borrowing request submitted successfully!");
        // Navigate to My Borrows page
        navigate('/my-borrows');
      } else {
        alert("An error occurred while submitting the request");
      }
    } catch (error) {
      if (error.inner) {
        const validationErrors = {};
        error.inner.forEach((err) => {
          validationErrors[err.path] = err.message;
        });
        setErrors(validationErrors);
      } else {
        alert(error.response?.data?.message || error.message || "An error occurred while submitting the request");
      }
    }
  };

  const minDate = new Date().toISOString().split("T")[0];

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle} className="fw-bold">
        <i className="bi bi-cart-plus me-2"></i>
        Request Device Borrowing
      </ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <FormGroup>
            <Label className="fw-bold">Device Name</Label>
            <Input type="text" value={device.name} disabled className="modern-input" />
          </FormGroup>
          <FormGroup>
            <Label className="fw-bold">Expected Return Date *</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={minDate}
              invalid={!!errors.returnDate}
              className="modern-input"
            />
            {errors.returnDate && (
              <FormText color="danger">{errors.returnDate}</FormText>
            )}
          </FormGroup>
          <FormGroup>
            <Label className="fw-bold">Device Condition Before Borrowing *</Label>
            {user && user.role === "Admin" ? (
              <>
                <Input
                  type="textarea"
                  value={conditionBefore}
                  onChange={(e) => setConditionBefore(e.target.value)}
                  placeholder="Describe the device condition before borrowing..."
                  invalid={!!errors.conditionBefore}
                  rows={4}
                  className="modern-input"
                />
                {errors.conditionBefore && (
                  <FormText color="danger">{errors.conditionBefore}</FormText>
                )}
              </>
            ) : (
              <>
                <div
                  className="modern-input"
                  style={{
                    padding: "12px 15px",
                    background: "#f8f9fa",
                    border: "2px solid #e2e8f0",
                    borderRadius: "8px",
                    color: "#495057",
                    minHeight: "50px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <i className="bi bi-check-circle-fill me-2 text-success"></i>
                  <span className="fw-bold">Excellent</span>
                </div>
                <input
                  type="hidden"
                  value="Excellent"
                  onChange={() => {}}
                />
              </>
            )}
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" className="btn-gradient" type="submit">
            <i className="bi bi-send me-2"></i>
            Submit Request
          </Button>
          <Button color="secondary" onClick={toggle}>
            Cancel
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

export default BorrowingForm;
