import React, { useState } from "react";
import { FaFutbol, FaTableTennis, FaBaseballBall } from "react-icons/fa";
import Cricket from "../../components/Tabs/Cricket";
import Futsal from "../Futsal";
import Padel from "../Padal";

type Tab = {
  id: string;
  name: string;
  icon: JSX.Element;
};

const tabs: Tab[] = [
  { id: "cricket", name: "Cricket", icon: <FaBaseballBall className="w-4 h-4 me-2" /> },
  { id: "futsal", name: "Futsal", icon: <FaFutbol className="w-4 h-4 me-2" /> },
  { id: "padel", name: "Padel Tennis", icon: <FaTableTennis className="w-4 h-4 me-2" /> },
];

const SportsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("cricket");

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500 dark:text-gray-400">
        {tabs.map((tab) => (
          <li key={tab.id} className="me-2">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg 
                ${activeTab === tab.id
                  ? "text-blue-600 border-blue-600 dark:text-blue-500 dark:border-blue-500"
                  : "border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300"
                }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          </li>
        ))}
      </ul>

      {/* Tab Content Section */}
      <div className="p-4 dark:text-white">
        {activeTab === "cricket" && <> <Cricket /></>}
        {activeTab === "futsal" && <><Futsal/> </>}
        {activeTab === "padel" && <><Padel /></>}
      </div>
    </div>
  );
};

export default SportsTabs;
