import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AnalysisResults } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ResultsChartsProps {
  results: AnalysisResults;
  length: number;
  units: { length: string; force: string };
}

export const ResultsCharts: React.FC<ResultsChartsProps> = ({ results, length, units }) => {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: 0,
        max: length,
        grid: {
          color: '#e5e7eb',
        },
        ticks: {
            callback: (value: any) => `${value} ${units.length}`
        }
      },
      y: {
        grid: {
          color: '#e5e7eb',
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };

  const momentUnit = `${units.force}·${units.length}`;

  const shearData = {
    datasets: [
      {
        label: `Fuerza Cortante (${units.force})`,
        data: results.x_points.map((x, i) => ({ x, y: results.shear_points[i] })),
        borderColor: '#2563eb', // blue-600
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        tension: 0, // Shear diagrams are straight lines usually
      },
    ],
  };

  const momentData = {
    datasets: [
      {
        label: `Momento Flector (${momentUnit})`,
        data: results.x_points.map((x, i) => ({ x, y: results.moment_points[i] })),
        borderColor: '#7c3aed', // violet-600
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        tension: 0.4, // Smooth for moment
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-64">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Diagrama de Fuerza Cortante (V)</h3>
        <div className="h-52">
            <Line options={commonOptions} data={shearData} />
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-64">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Diagrama de Momento Flector (M)</h3>
        <div className="h-52">
             <Line options={commonOptions} data={momentData} />
        </div>
      </div>
    </div>
  );
};