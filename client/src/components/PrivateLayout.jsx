import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../common/Navbar'
import Sidebar from '../common/Sidebar'
import { Container } from 'reactstrap'

const PrivateLayout = () => {
  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1">
        <Navbar />
        <Container fluid className="mt-4 mb-4">
          <Outlet />
        </Container>
      </div>
    </div>
  )
}

export default PrivateLayout

