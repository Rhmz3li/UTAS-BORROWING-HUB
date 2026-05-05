import React from 'react';
import { Modal, ModalHeader, ModalBody, Button } from 'reactstrap';
import { FaQrcode, FaSearch, FaSyncAlt } from 'react-icons/fa';

/**
 * Single entry point for scanning resources:
 * choose between "Scan for Search" and "Scan & Update Status" (admin only for status updates).
 */
const ScanResourceManagement = ({ isOpen, toggle, onScanResource, onScanUpdateStatus, isAdmin }) => {
  const handleScanResource = () => {
    toggle();
    onScanResource?.();
  };

  const handleScanUpdateStatus = () => {
    toggle();
    onScanUpdateStatus?.();
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="sm" centered>
      <ModalHeader toggle={toggle} className="border-0 pb-0">
        <span className="d-flex align-items-center gap-2">
          <FaQrcode />
          Scan Resource Management
        </span>
      </ModalHeader>
      <ModalBody className="pt-2">
        <div className="d-grid gap-2">
          <Button color="primary" outline className="d-flex align-items-center justify-content-center gap-2 py-3" onClick={handleScanResource}>
            <FaSearch />
            Scan Resource
          </Button>
          {isAdmin && (
            <Button color="success" outline className="d-flex align-items-center justify-content-center gap-2 py-3" onClick={handleScanUpdateStatus}>
              <FaSyncAlt />
              Scan & Update Status
            </Button>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default ScanResourceManagement;
