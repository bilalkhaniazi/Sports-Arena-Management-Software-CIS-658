import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify'; // or another toast library
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { useNavigate } from 'react-router-dom';

// Adjust as needed
const API_BASE_URL = 'http://localhost:5000/api';
const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

// 1) Fetch existing custom message
async function fetchCustomMessage() {
  const res = await axios.get(`${API_BASE_URL}/${getBackofficeScope()}/messages/custom-message`);
  return res.data; // Expecting { message: string }
}
type data = {
  message: string;
};
// 2) Update custom message
async function updateCustomMessage(
  newMessage: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/${getBackofficeScope()}/messages/custom-message`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: newMessage }),
  });
  if (!res.ok) {
    throw new Error('Failed to update custom message');
  }
  // For instance: { message: "Message updated successfully!" }
  return res.json();
}

const CustomMessage: React.FC = () => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth/signin');
    }
  }, []);

  // React Query: fetch the current message
  const { data, isLoading, isError, error, isFetching } = useQuery<
    { message: string },
    Error
  >({
    queryKey: ['customMessage'],
    queryFn: fetchCustomMessage,
  });

  // React Query: mutation for updating the message
  const mutation = useMutation<{ message: string }, Error, string>({
    mutationFn: updateCustomMessage,
    onSuccess: (data) => {
      // 'data' is { message: string }
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['customMessage'] });
    },
    onError: () => {
      toast.error('Failed to update the message.');
    },
  });

  // Populate local state when data arrives
  useEffect(() => {
    if (data?.message) {
      setMessage(data.message);
    }
  }, [data]);

  // 3) Handle Update
  const handleUpdate = () => {
    // Validate min length
    if (message.trim().length < 10) {
      toast.error('Message must be at least 10 characters.');
      return;
    }
    // Call the mutation
    mutation.mutate(message);
  };

  if (isError) {
    return (
      <>
        <Breadcrumb pageName="Custom Message" />
        <div className="p-4 text-red-500 dark:text-red-400">
          Error: {error?.message}
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Custom Message" />
      <div>
        <div className="mb-6">
          <label className="mb-2.5 block text-black dark:text-white">
            Message
          </label>
          <textarea
            rows={6}
            placeholder="Type your message"
            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button
          className="flex w-fit justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90"
          onClick={handleUpdate}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Updating...' : 'Update'}
        </button>
      </div>
    </>
  );
};

export default CustomMessage;
