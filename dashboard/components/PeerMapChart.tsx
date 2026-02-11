'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { PeersData } from '@/lib/types';

interface PeerMapChartProps {
  peers: PeersData;
}

export default function PeerMapChart({ peers }: PeerMapChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const initChart = async () => {
      try {
        // Fetch world map JSON from local file
        const response = await fetch('/world.json');
        if (!response.ok) {
          throw new Error(`Failed to load world.json: ${response.status}`);
        }
        const worldJson = await response.json();
        
        // Register world map
        echarts.registerMap('world', worldJson);

        // Dispose existing chart
        if (chartInstanceRef.current) {
          chartInstanceRef.current.dispose();
        }

        const chart = echarts.init(chartRef.current!, 'dark', {
          renderer: 'canvas',
        });

        chartInstanceRef.current = chart;

        // Prepare country heatmap data
        const countryData = Object.entries(peers.countries || {}).map(([code, info]) => ({
          name: code.toUpperCase(),
          value: info.count,
        }));

        // Prepare peer scatter data
        const peerData = (peers.peers || [])
          .filter(p => p.lat !== 0 && p.lon !== 0)
          .map(p => ({
            name: `${p.city}, ${p.country}`,
            value: [p.lon, p.lat, p.inbound ? 1 : 0],
            itemStyle: {
              color: p.inbound ? '#10B981' : '#1E90FF',
            },
          }));

        const option = {
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'item' as const,
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
            textStyle: {
              color: '#F9FAFB',
              fontFamily: 'var(--font-fira-sans)',
            },
            formatter: (params: any) => {
              if (params.seriesType === 'effectScatter') {
                const peer = peers.peers?.find(p => 
                  p.lat === params.value[1] && p.lon === params.value[0]
                );
                if (peer) {
                  return [
                    `<div style="font-weight: 600; margin-bottom: 4px; color: #F9FAFB;">${peer.city}, ${peer.country}</div>`,
                    `<div style="font-size: 12px; color: #6B7280;">IP: ${peer.ip}</div>`,
                    `<div style="font-size: 12px; color: #6B7280;">ISP: ${peer.isp}</div>`,
                    `<div style="font-size: 12px; color: ${peer.inbound ? '#10B981' : '#1E90FF'};">`,
                    `  ${peer.inbound ? '↘ Inbound' : '↗ Outbound'}`,
                    `</div>`,
                  ].join('');
                }
              }
              if (params.seriesType === 'map') {
                const count = params.value || 0;
                return `<div style="color: #F9FAFB; font-weight: 500;">${params.name}</div><div style="color: #6B7280;">Peers: <b style="color: #1E90FF;">${count}</b></div>`;
              }
              return params.name;
            },
          },
          visualMap: {
            show: false,
            min: 0,
            max: Math.max(1, ...countryData.map((d: any) => d.value)),
            inRange: {
              color: ['#111827', '#1a2332', '#1E90FF'],
            },
          },
          geo: {
            map: 'world',
            roam: true,
            zoom: 1.2,
            center: [10, 30] as [number, number],
            itemStyle: {
              areaColor: '#111827',
              borderColor: 'rgba(255, 255, 255, 0.06)',
              borderWidth: 0.5,
            },
            emphasis: {
              itemStyle: {
                areaColor: '#1a2332',
              },
              label: {
                show: false,
              },
            },
          },
          series: [
            {
              name: 'Peer Density',
              type: 'map' as const,
              map: 'world',
              geoIndex: 0,
              data: countryData,
              select: { disabled: true },
            },
            {
              name: 'Peers',
              type: 'effectScatter' as const,
              coordinateSystem: 'geo' as const,
              data: peerData,
              symbolSize: 10,
              showEffectOn: 'render' as const,
              rippleEffect: {
                brushType: 'stroke' as const,
                scale: 3,
                period: 4,
                color: (params: any) => params.data.itemStyle?.color,
              },
              label: {
                show: false,
              },
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
              emphasis: {
                scale: true,
              },
            },
          ],
        };

        chart.setOption(option);

        // Handle resize
        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          chart.dispose();
        };
      } catch (error) {
        console.error('Error initializing map chart:', error);
      }
    };

    initChart();
  }, [peers]);

  return <div ref={chartRef} className="w-full h-[300px] sm:h-[350px] lg:h-[450px]" />;
}
