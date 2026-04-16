import React, { useEffect } from 'react';
import ProductTable from '../../components/ProductTable';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { useNavigate } from 'react-router-dom';
const BookingHistory: React.FC = () => {
    const navigate = useNavigate();
    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/auth/signin');
      }
    }, []);
  return (
    <div>
          <Breadcrumb pageName="Booking History" />
            <ProductTable />
    </div>
  );
};

export default BookingHistory;
