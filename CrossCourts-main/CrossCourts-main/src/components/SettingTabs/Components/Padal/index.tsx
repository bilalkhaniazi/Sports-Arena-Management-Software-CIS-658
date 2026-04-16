import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaCalendarAlt } from 'react-icons/fa';
import {
  fetchCourtsByCategory,
  fetchSlots,
  updateCourtSchedule
  
} from '../../../../api/courtService';
import CustomDatePicker from '../../../Forms/DatePicker/CustomDatePicker';
import { toast } from 'react-toastify';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from '../../../../components/Modal';
type Court = {
  id: number;
  name: string;
};

type Slot = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
};
type selected = {
  id:number;
  start_time:string
  end_time:string
}
function Padel() {
  const [selectedCourt, setSelectedCourt] = useState<number>(5);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
  );
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isModified, setIsModified] = useState(false); // Track changes
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [slotNumber, setSlotNumber] = useState<selected>({
   id:0,
   start_time:"",
   end_time:""
  });
  // ✅ Format date for display
  useEffect(() => {
    setFormattedDate(
      new Date(selectedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York',
      }),
    );
  }, [selectedDate]);

  // ✅ Fetch slots
  const {
    data: slotsData,
    isLoading: isSlotLoading,
    error: isSlotError,
  } = useQuery({
    queryKey: ['slots__', selectedCourt, selectedDate],
    queryFn: () => fetchSlots(selectedCourt, selectedDate),
  });

  // ✅ Use useEffect to update state when data changes
  useEffect(() => {
    if (slotsData?.slots) {
      setSlots(slotsData.slots);
      setIsModified(false);
    }
  }, [slotsData]);

  // ✅ Fetch courts
  const {
    data: courts,
    error: isCourtError,
    isLoading: isCourtLoading,
  } = useQuery({
    queryKey: ['courts__', 3], // cat_id = 3 for Padel
    queryFn: () => fetchCourtsByCategory(3),
  });


  // Initialize react-query client
  const queryClient = useQueryClient();
  const { mutate: saveSlots, isPending: isSaving } = useMutation<
  void, // Type for returned data
  Error, // Type for potential errors
  { court_id: number; date: string; custom_slots: { start_time: string; end_time: string }[] } // Mutation parameters
>({
  mutationFn: async ({ court_id, date, custom_slots }) => {
    return updateCourtSchedule(court_id, date, custom_slots);
  },
  onSuccess: () => {
    toast.success("Slots updated successfully!");
    setIsModified(false);
    queryClient.invalidateQueries({ queryKey: ["slots__", selectedCourt, selectedDate] }); // 🔹 FIX query invalidation
  },
  onError: (error) => {
    toast.error(error.message || "Error updating slots.");
  },
});

const handleSaveChanges1 = () => {
  saveSlots({
    court_id: selectedCourt,
    date: selectedDate,
    custom_slots: slots.map((slot) => ({
      start_time: slot.start_time,
      end_time: slot.end_time,
    })),
  });
};

  // ✅ Handle slot editing
  const handleEditSlot = (index: number, field: keyof Slot, value: string) => {
    const timePattern = /^([01]?[0-9]|2[0-3]):([0-5]?[0-9]):([0-5]?[0-9])$/;

    if (!timePattern.test(value)) {
      return; // Prevent updating if input is invalid
    }

    // Create a copy of slots array
    const updatedSlots = [...slots];
    updatedSlots[index] = { ...updatedSlots[index], [field]: value };

    // Convert time string to minutes
    const timeToMinutes = (time: string) => {
      const [hh, mm, ss] = time.split(':').map(Number);
      return hh * 60 + mm; // Convert HH:MM to total minutes
    };

    const newStart = timeToMinutes(updatedSlots[index].start_time);
    const newEnd = timeToMinutes(updatedSlots[index].end_time);

    // Check for overlaps
    for (let i = 0; i < updatedSlots.length; i++) {
      if (i !== index) {
        const existingStart = timeToMinutes(updatedSlots[i].start_time);
        const existingEnd = timeToMinutes(updatedSlots[i].end_time);

        if (
          (newStart >= existingStart && newStart < existingEnd) || // Overlaps existing slot
          (newEnd > existingStart && newEnd <= existingEnd) || // Ends within existing slot
          (newStart <= existingStart && newEnd >= existingEnd) // Completely overlaps another slot
        ) {
          toast.error('Time slot overlaps with another slot! Please adjust.');
          return;
        }
      }
    }

    // If no overlap, update state
    setSlots(updatedSlots);
    setIsModified(true);
  };
 
  const handleDeleteSlot = (index: number) => {
    const selectedSlot = slots[index]; // Fetch slot details
  
    if (!selectedSlot) return; // Prevent errors if slot doesn't exist
  
    setSlotNumber(selectedSlot); // Store selected slot in state
    setDeleteOpen(true); // Open the delete confirmation modal
  };
  
  const deleteSlot = () => {
    const updatedSlots = slots.filter((_, i) => i !== slotNumber.id -1);
    setSlots(updatedSlots);
    setIsModified(true); // Track changes
  };



  return (
    <div>
        <Modal
        isOpen={deleteOpen}
        btnText={'Confirm'}
        color={'bg-danger'}
        onClose={() => setDeleteOpen(false)}
        title={`Slot ${slotNumber.id} (${slotNumber.start_time} - ${slotNumber.end_time})`}
        onSubmit={deleteSlot}
      >
        <p>Are you sure you want to cancel this booking slot?</p>
      </Modal>
      <div className="lg:flex lg:items-center lg:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <div className="mt-1 flex flex-col sm:flex-row sm:space-x-6">
           
            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <FaCalendarAlt className="mr-1.5 size-5 shrink-0 text-gray-400 dark:text-gray-500" />
              {formattedDate}
            </div>
          </div>
          <div className="flex flex-col mt-5 md:flex-row justify-end items-end gap-6">
            {/* Courts Dropdown */}
            <div className="min-w-1/4 w-full md:w-1/4">
              <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                Select Court
              </label>
              {isCourtLoading ? (
                <p>Loading courts...</p>
              ) : isCourtError ? (
                <p className="text-red-500">Error fetching courts.</p>
              ) : (
                <select
                  className="form-datepicker w-full capitalize rounded border-[1.5px] border-stroke bg-transparent px-3 py-3 font-normal outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  value={selectedCourt}
                  onChange={(e) => setSelectedCourt(Number(e.target.value))}
                >
                  {courts?.map((court: Court) => (
                    <option
                      key={court.id}
                      value={court.id}
                      className="capitalize"
                    >
                      {court.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="min-w-1/4 w-full md:w-1/4">
              <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                Date
              </label>
              <CustomDatePicker
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-x-auto rounded-lg shadow max-h-[415px] overflow-y-scroll  [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-gray-100
            [&::-webkit-scrollbar-thumb]:bg-gray-300
            dark:[&::-webkit-scrollbar-track]:bg-neutral-700
            dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
      >
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs sticky top-0 text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 text-center py-3">SR#</th>
              <th className="px-6 text-center py-3">Slot Name</th>
              <th className="px-6 text-center py-3">Start Time</th>
              <th className="px-6 text-center py-3">End Time</th>
              <th className="px-6 text-center py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isSlotLoading ? (
              <tr>
                <td colSpan={12} className="px-6 py-4 text-center">
                  <div
                    role="status"
                    className="flex justify-center items-center w-full h-full"
                  >
                    <svg
                      aria-hidden="true"
                      className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                      viewBox="0 0 100 101"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                      />
                      <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                      />
                    </svg>
                    <span className="sr-only">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : isSlotError ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-red-500">
                  Failed to load slots.
                </td>
              </tr>
            ) : slots.length > 0 ? (
              slots.map((slot, index) => (
                <tr
                  key={slot.id}
                  className="bg-white border-b dark:bg-gray-800 text-center dark:border-gray-700"
                >
                  <td className="px-6 py-4">{index + 1}</td>
                  <td className="px-6 py-4">
                    {slot.name ? slot.name : `Slot ${index + 1}`}
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={slot.start_time}
                      onChange={(e) =>
                        handleEditSlot(index, 'start_time', e.target.value)
                      }
                      className="w-full outline-none bg-transparent text-center"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={slot.end_time}
                      onChange={(e) =>
                        handleEditSlot(index, 'end_time', e.target.value)
                      }
                      className="w-full bg-transparent outline-none text-center"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDeleteSlot(index)}
                      className="text-red-500"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  No slots available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModified && (
  <button
    onClick={handleSaveChanges1}
    disabled={isSaving} // Disable button while saving
    className={`mt-4 rounded-md inline-flex items-center justify-center 
      bg-primary py-2 px-5 text-center font-medium text-white hover:bg-opacity-90 
      lg:px-8 xl:px-10 ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {isSaving ? (
      <div className="flex items-center gap-2">
        <svg
          className="animate-spin h-5 w-5 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="4" />
          <path d="M4 12a8 8 0 018-8" strokeWidth="4" />
        </svg>
        Saving...
      </div>
    ) : (
      "Save Changes"
    )}
  </button>
)}

    </div>
  );
}

export default Padel;
