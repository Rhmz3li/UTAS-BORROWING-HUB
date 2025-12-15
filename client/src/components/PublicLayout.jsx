import React from 'react'
import { Outlet } from 'react-router-dom'
import { Container } from 'reactstrap'

const PublicLayout = () => {
  return (
    <div className="min-vh-100 d-flex align-items-center" style={{ background: 'linear-gradient(135deg, #0066cc 0%, #ff6600 100%)' }}>
      <Container>
        <Outlet />
      </Container>
    </div>
  )
}

export default PublicLayout

