import React, { useState, useMemo } from 'react';
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

import { Select } from '@mui/material';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const PerformanceAnalyzer = () => {
  const [selectedMetric, setSelectedMetric] = useState('total');
  
  // Sample data structure - you would replace this with your actual data
  const sampleData = [
    {
      functionName: "ark_ff::fields::models::fp::montgomery_backend::MontBackend",
      metrics: {
        test1: { v1: 1000, v2: 1200, v3: 800 },
        test2: { v1: 900, v2: 950, v3: 850 }
      }
    },
    // ... more functions
  ];

  const processedData = useMemo(() => {
    // Transform data for visualization
    return sampleData.map(func => ({
      name: func.functionName.split('::').pop(), // Show only last part of name
      ...Object.keys(func.metrics).reduce((acc, test) => ({
        ...acc,
	//        [`${test}_v1`]: func.metrics[test].v1,
	//        [`${test}_v2`]: func.metrics[test].v2,
	//        [`${test}_v3`]: func.metrics[test].v3,
      }), {})
    }));
  }, []);

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis Across Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <LineChart
              width={800}
              height={400}
              data={processedData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Ticks', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="test1_v1" 
                stroke="#8884d8" 
                name="Test 1 (V1)" 
              />
              <Line 
                type="monotone" 
                dataKey="test1_v2" 
                stroke="#82ca9d" 
                name="Test 1 (V2)" 
              />
              <Line 
                type="monotone" 
                dataKey="test1_v3" 
                stroke="#ffc658" 
                name="Test 1 (V3)" 
              />
            </LineChart>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border">Function</th>
                  <th className="p-2 border">Best Version</th>
                  <th className="p-2 border">Worst Version</th>
                  <th className="p-2 border">Variance</th>
                </tr>
              </thead>
              <tbody>
                {sampleData.map((func, i) => {
                  const allValues = Object.values(func.metrics)
                    .flatMap(v => Object.values(v));
                  const min = Math.min(...allValues);
                  const max = Math.max(...allValues);
                  const variance = ((max - min) / min * 100).toFixed(1);
                  
                  return (
                    <tr key={i}>
                      <td className="p-2 border">{func.functionName.split('::').pop()}</td>
                      <td className="p-2 border text-green-600">{min.toLocaleString()}</td>
                      <td className="p-2 border text-red-600">{max.toLocaleString()}</td>
                      <td className="p-2 border">{variance}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceAnalyzer;
