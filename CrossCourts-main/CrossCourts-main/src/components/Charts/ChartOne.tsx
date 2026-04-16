import React from "react";
import ReactApexChart from "react-apexcharts";
import { useQuery } from "@tanstack/react-query";
import { ApexOptions } from "apexcharts";

// ------------------ Types ------------------
type MonthlyCourtBooking = {
  court_id: number;
  court_name: string;
  month: string;      // e.g. "Jan"
  month_num: number;  // e.g. 1 (for January)
  totalBookings: number;
};

const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

function buildMonthlyUrl(arenaId: string, courtId: string): string {
  const scope = getBackofficeScope();
  const p = new URLSearchParams();
  if (arenaId !== "all") p.set("arena_id", arenaId);
  if (courtId !== "all") p.set("court_id", courtId);
  const qs = p.toString();
  return `http://localhost:5000/api/${scope}/reports/bookings-per-month${qs ? `?${qs}` : ""}`;
}

type ChartOneProps = {
  filterArena?: string;
  filterCourt?: string;
};

const ChartOne: React.FC<ChartOneProps> = ({
  filterArena = "all",
  filterCourt = "all",
}) => {
  // ------------------ React Query ------------------
  const {
    data: monthlyData = [],
    isLoading,
    isError,
    error,
  } = useQuery<MonthlyCourtBooking[], Error>({
    queryKey: ["monthlyBookings", filterArena, filterCourt],
    queryFn: async () => {
      const res = await fetch(buildMonthlyUrl(filterArena, filterCourt));
      if (!res.ok) {
        throw new Error("Failed to fetch monthly bookings");
      }
      return res.json();
    },
  });

  // ------------------ Loading & Error States ------------------
  if (isLoading) {
    return <div className="p-4">Loading chart...</div>;
  }
  if (isError) {
    return <div className="p-4 text-red-500">Error: {error?.message}</div>;
  }

  // ------------------ Build the Chart Data ------------------
  // All 12 months in short form
  const allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Create a dictionary to store data per court:
  // courtSeriesMap[court_id] = {
  //   courtName: string,
  //   data: number[] (length 12, one entry per month)
  // }
  const courtSeriesMap: Record<number, { courtName: string; data: number[] }> = {};

  // Initialize the map with an empty array of length 12 for each row
  monthlyData.forEach((row) => {
    if (!courtSeriesMap[row.court_id]) {
      courtSeriesMap[row.court_id] = {
        courtName: row.court_name,
        data: new Array(12).fill(0),
      };
    }
    // Place totalBookings at the correct month index
    // e.g. month_num = 1 => index 0 for January
    courtSeriesMap[row.court_id].data[row.month_num - 1] = row.totalBookings;
  });

  // Convert the map into an array of ApexChart series
  // e.g. [{ name: 'Cricket natural grass', data: [0, 3, 2, ...] }, ...]
  const series = Object.values(courtSeriesMap).map((courtObj) => ({
    name: courtObj.courtName,
    data: courtObj.data,
  }));

  // ------------------ Chart Configuration ------------------
  const options: ApexOptions = {
    chart: {
      type: "area",
      height: 335,
      fontFamily: "Satoshi, sans-serif",
      dropShadow: {
        enabled: true,
        color: "#623CEA14",
        top: 10,
        blur: 4,
        left: 0,
        opacity: 0.1,
      },
      toolbar: { show: false },
    },
    // We'll use a single color array for now. Apex will automatically
    // generate different shades. You can customize more if you like.
    colors: ["#3C50E0", "#80ca00", "#FF4560", "#008FFB", "#FEB019", "#775DD0"],
    legend: {
      show: true, // show legend so you can see each court's line
      position: "top",
      horizontalAlign: "left",
    },
    responsive: [
      {
        breakpoint: 1024,
        options: { chart: { height: 300 } },
      },
      {
        breakpoint: 1366,
        options: { chart: { height: 350 } },
      },
    ],
    stroke: {
      width: [2],
      curve: "straight",
    },
    grid: {
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
    },
    dataLabels: { enabled: false },
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColors: ["#3056D3"],
      strokeWidth: 3,
      strokeOpacity: 0.9,
      fillOpacity: 1,
      hover: { sizeOffset: 5 },
    },
    xaxis: {
      type: "category",
      categories: allMonths, // x-axis labels
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { min: 0 },
  };

  // ------------------ Render ------------------
  return (
    <div className="col-span-12 h-full rounded-sm border border-stroke bg-white px-5 pt-7.5 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:col-span-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-semibold text-primary">Monthly Bookings</p>
          <p className="text-sm font-medium">
            Overview by court &amp; month (uses dashboard arena/court filters)
          </p>
        </div>
      </div>
      <div id="chartOne" className="-ml-5 md:mt-14">
        <ReactApexChart
          options={options}
          series={series}
          type="area"
          height={350}
        />
      </div>
    </div>
  );
};

export default ChartOne;
