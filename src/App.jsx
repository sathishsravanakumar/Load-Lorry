import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, RoundedBox } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO } from '@react-three/postprocessing';
import * as THREE from 'three';
import { 
  LayoutDashboard, 
  AlertCircle, 
  FileText, 
  TrendingUp, 
  Truck, 
  User,
  Zap
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

import bgImage from './assets/logistics_bg.png';
import mapImage from './assets/logistics_map.png';

// ====================================================================
// DATA MOCK-UP
// ====================================================================
const DRIVERS = [
  { id:1, name:"Raj Patel", initials:"RP", location:"Phoenix, AZ", hos:7.2, inspection:6, fatigue:"low", status:"available", truck:"TRUCK-012", health:"healthy", score:98, onTime:97, color:"#39abd4", reasons:["HOS 7.2hrs · buffer 1.8hrs ✓","Inspection 6 days ago ✓", "Fatigue: low ✓","Return load Dallas 71% ✓","Truck all green ✓"] },
  { id:2, name:"Frank Chen", initials:"FC", location:"Tucson, AZ", hos:1.8, inspection:32, fatigue:"high", status:"blocked", truck:"TRUCK-007", health:"critical", score:34, onTime:88, color:"#f87171", reasons:[], warnings:["🔴 Tire pressure 67 PSI — TRUCK-007 blowout risk", "🔴 Inspection overdue — 32 days", "🔴 HOS insufficient — 1.8hrs only"] },
  { id:3, name:"Lisa Rodriguez", initials:"LR", location:"Mesa, AZ", hos:5.4, inspection:12, fatigue:"medium", status:"available", truck:"TRUCK-009", health:"warning", score:72, onTime:95, color:"#a78bfa", reasons:["HOS 5.4hrs ✓","Inspection 12 days ago ✓","El Paso return 45%"] },
  { id:4, name:"Marcus Johnson", initials:"MJ", location:"Scottsdale, AZ", hos:9.1, inspection:3, fatigue:"low", status:"available", truck:"TRUCK-015", health:"healthy", score:91, onTime:96, color:"#4ade80", reasons:["Inspection 3 days ago ✓","Tires nominal 89 PSI ✓","Engine no faults ✓","Return load 52% from Denver","Fatigue: low ✓"] },
];

const INITIAL_LOADS = [
  { id:306, pickup:"Mesa, AZ", delivery:"Los Angeles, CA", deadline:"Tomorrow 10:00 AM", priority:"high", rate:3200, miles:372, cargo:"Auto Parts", weight:35000, status:"needs_input", candidates:[1,3], returnProb:82, tag:"NEEDS INPUT" },
  { id:307, pickup:"Chandler, AZ", delivery:"Houston, TX", deadline:"Tomorrow 4:00 PM", priority:"high", rate:3650, miles:1178, cargo:"Chemical Supplies", weight:44000, status:"blocked", driverId:2, returnProb:68, blockReason:"TRUCK-007 critical tire pressure 67 PSI — blowout risk on highway", tag:"BLOCKED" },
  { id:308, pickup:"Phoenix, AZ", delivery:"Denver, CO", deadline:"Tomorrow 12:00 PM", priority:"medium", rate:2980, miles:601, cargo:"Electronics", weight:39000, status:"ready", driverId:4, returnProb:52, hosWarning:true, tag:"READY" },
  { id:303, pickup:"Phoenix, AZ", delivery:"Dallas, TX", deadline:"Today 8:00 PM", priority:"high", rate:2840, miles:1067, cargo:"Industrial Eq.", weight:42000, status:"assigned", driverId:1, returnProb:71 },
  { id:302, pickup:"Tucson, AZ", delivery:"El Paso, TX", deadline:"Today 11:30 PM", priority:"medium", rate:1920, miles:544, cargo:"Retail Goods", weight:38000, status:"assigned", driverId:3, returnProb:45 },
];

const ALERTS = [
  { id:1, severity:"critical", loadId:304, driver:"Frank Chen", title:"Relay Needed — HOS Expiring", message:"Frank Chen hits HOS limit in 47 min. ETA 72 min. Delivery window at risk.", action:"Relay with Raj Patel · Exit 202 Tucson" }
];

// ====================================================================
// 3D COMPONENT: TRUCK MODEL (Aero Modern Blue)
// ====================================================================
function TruckModel({ truckData }) {
  const group = useRef();
  const getStatusInfo = (val, type) => {
    if (type === 'tire' || type === 'brakes') {
      if (val < 75) return { color: '#f87171', emissive: '#ef4444', intensity: 1.5, pulse: true };
      if (val < 85) return { color: '#fbbf24', emissive: '#f59e0b', intensity: 0.8, pulse: false };
      return null;
    }
    if (type === 'engine') {
      if (val === 'FAULT') return { color: '#f87171', emissive: '#ef4444', intensity: 1.5, pulse: true };
      if (val === 'SERVICE') return { color: '#fbbf24', emissive: '#f59e0b', intensity: 0.8, pulse: false };
      return null;
    }
    return null;
  };

  const tireRLStatus = getStatusInfo(truckData.tireRL, 'tire');
  const engineStatus = getStatusInfo(truckData.engine, 'engine');

  const StatusMaterial = ({ info, baseColor = '#004a99' }) => {
    const matRef = useRef();
    useFrame((state) => {
      if (matRef.current && info?.pulse) {
        matRef.current.emissiveIntensity = 0.5 + Math.abs(Math.sin(state.clock.getElapsedTime() * 3)) * 1.5;
      }
    });
    return (
      <meshPhysicalMaterial 
        ref={matRef}
        color={info ? info.color : baseColor}
        roughness={0.2} metalness={0.6} clearcoat={1.0}
        emissive={info ? info.emissive : '#000000'}
        emissiveIntensity={info ? info.intensity : 0}
      />
    );
  };

  const chromeMat = <meshPhysicalMaterial color="#ffffff" metalness={1.0} roughness={0.05} clearcoat={1.0} envMapIntensity={1.5} />;
  const rubberMat = <meshStandardMaterial color="#0a0a0a" roughness={0.9} />;
  const glassMat = <meshPhysicalMaterial color="#020617" roughness={0} metalness={0.9} transparent opacity={0.6} transmission={0.5} />;
  const frameMat = <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.7} />;

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.getElapsedTime() * 0.15;
  });

  return (
    <group ref={group} scale={0.8} position={[1.0, -0.6, 0]}>
      <mesh position={[-1.0, 0.4, 0.4]}><boxGeometry args={[11, 0.2, 0.15]} />{frameMat}</mesh>
      <mesh position={[-1.0, 0.4, -0.4]}><boxGeometry args={[11, 0.2, 0.15]} />{frameMat}</mesh>
      <RoundedBox args={[0.3, 0.6, 2.6]} position={[4.4, 0.4, 0]} radius={0.05}>{chromeMat}</RoundedBox>
      <RoundedBox args={[0.1, 1.2, 1.4]} position={[4.1, 1.0, 0]} radius={0.05}>{chromeMat}</RoundedBox>
      <mesh position={[4.16, 1.0, 0]}><boxGeometry args={[0.02, 1.1, 1.2]} /><meshStandardMaterial color="#111" metalness={0.8} /></mesh>
      {/* Engine Area (Highlightable) */}
      <group position={[2.5, 1.0, 0]}>
        <RoundedBox args={[1.8, 1.2, 1.8]} radius={0.2} smoothness={4}><StatusMaterial info={engineStatus} /></RoundedBox>
        <mesh position={[0.8, -0.2, 0.7]}><boxGeometry args={[0.1, 0.2, 0.4]} /><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} /></mesh>
        <mesh position={[0.8, -0.2, -0.7]}><boxGeometry args={[0.1, 0.2, 0.4]} /><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} /></mesh>
      </group>
      <group position={[0.8, 1.6, 0]}>
        <RoundedBox args={[2.8, 2.2, 2.2]} radius={0.15}><StatusMaterial info={null} /></RoundedBox>
        <RoundedBox args={[2.4, 1.2, 2.15]} position={[-0.2, 1.2, 0]} radius={0.1}><StatusMaterial info={null} /></RoundedBox>
        <mesh position={[1.0, 0.8, 0]} rotation={[0, 0, -Math.PI/6]}><boxGeometry args={[1.5, 0.8, 2.15]} /><StatusMaterial info={null} /></mesh>
      </group>
      <mesh position={[2.22, 2.2, 0]} rotation={[0, 0, -Math.PI/6]}><planeGeometry args={[1.6, 1.2]} />{glassMat}</mesh>
      <RoundedBox args={[3.2, 1.0, 0.2]} position={[0.8, 0.5, 1.1]} radius={0.05}><StatusMaterial info={null} /></RoundedBox>
      <RoundedBox args={[3.2, 1.0, 0.2]} position={[0.8, 0.5, -1.1]} radius={0.05}><StatusMaterial info={null} /></RoundedBox>
      <group position={[-5.8, 2.4, 0]}>
        <RoundedBox args={[10.2, 3.8, 2.5]} radius={0.05}><meshStandardMaterial color="#f1f5f9" roughness={0.4} metalness={0.1} /></RoundedBox>
        <RoundedBox args={[0.6, 1.2, 1.6]} position={[5.4, 0.2, 0]} radius={0.02}>{frameMat}</RoundedBox>
      </group>
      {[ 
        [3.6, 0.4, 1.1], [3.6, 0.4, -1.1], 
        [0.8, 0.4, 1.15], [0.8, 0.4, 0.75], [0.8, 0.4, -1.15], [0.8, 0.4, -0.75], 
        [-0.4, 0.4, 1.15], [-0.4, 0.4, 0.75], [-0.4, 0.4, -1.15], [-0.4, 0.4, -0.75], 
        [-7.0, 0.4, 1.15], [-7.0, 0.4, 0.75], [-7.0, 0.4, -1.15], [-7.0, 0.4, -0.75], 
        [-8.4, 0.4, 1.15], [-8.4, 0.4, 0.75], [-8.4, 0.4, -1.15], [-8.4, 0.4, -0.75] 
      ].map((pos, i) => {
        const isRearLeftTire = pos[0] === 0.8 && pos[2] === 1.15;
        const tireMat = isRearLeftTire && tireRLStatus ? (
          <meshPhysicalMaterial color={tireRLStatus.color} emissive={tireRLStatus.emissive} emissiveIntensity={tireRLStatus.intensity} roughness={0.1} />
        ) : rubberMat;
        return (
          <group key={i} position={pos} rotation={[Math.PI/2, 0, 0]}>
            <mesh><cylinderGeometry args={[0.42, 0.42, 0.35, 32]} />{tireMat}</mesh>
            <mesh position={[0, pos[2]>0?0.18:-0.18, 0]}><cylinderGeometry args={[0.25, 0.2, 0.05, 32]} />{chromeMat}</mesh>
          </group>
        );
      })}
      <mesh position={[-0.6, 2.5, 0.9]}><cylinderGeometry args={[0.08, 0.08, 3.5, 16]} />{frameMat}</mesh>
    </group>
  );
}

// ====================================================================
// SUB-SCREENS
// ====================================================================

function DispatchBoard({ loads, onConfirm, onViewTwin }) {
  const [selectedDrivers, setSelectedDrivers] = useState({});
  const [showingAlt, setShowingAlt] = useState({});

  const readyCount = loads.filter(l => ['ready','needs_input'].includes(l.status)).length;
  const blockedCount = loads.filter(l => l.status === 'blocked').length;
  const liveCount = 5 + (INITIAL_LOADS.length - loads.filter(l => l.status !== 'assigned').length);

  const DriverCard = ({ d, selected, onClick }) => (
    <div onClick={onClick} style={{
      flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
      background: selected ? 'rgba(57, 171, 212, 0.15)' : 'rgba(255,255,255,0.03)',
      border: selected ? '2px solid var(--blue)' : '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', color: '#000' }}>{d.initials}</div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>{d.name}</div>
          <div className="small" style={{ color: 'var(--muted)' }}>Score {d.score}</div>
        </div>
      </div>
    </div>
  );

  const ReturnBar = ({ prob }) => (
    <div style={{ marginBottom: '16px' }}>
      <p className="small" style={{ marginBottom: '6px' }}>{prob}% return load probability</p>
      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${prob}%`, height: '100%', background: prob > 60 ? 'var(--green)' : prob > 40 ? 'var(--amber)' : 'var(--red)', borderRadius: '4px' }} />
      </div>
    </div>
  );

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px' }}>
        <h2>Morning Dispatch Queue</h2>
        <p>AI-scored load assignments based on 48hr predictive routing</p>
      </div>
      <div className="stat-row">
        <div className="stat-card"><h3>Live Loads</h3><div className="val" style={{color:'var(--blue)'}}>{liveCount}</div></div>
        <div className="stat-card"><h3>Ready</h3><div className="val" style={{color:'var(--green)'}}>{readyCount}</div></div>
        <div className="stat-card"><h3>At Risk</h3><div className="val" style={{color:'var(--amber)'}}>1</div></div>
        <div className="stat-card"><h3>Blocked</h3><div className="val" style={{color:'var(--red)'}}>{blockedCount}</div></div>
      </div>

      {loads.filter(l => l.status !== 'assigned').map(load => {
        const driver = load.driverId ? DRIVERS.find(d => d.id === load.driverId) : null;
        return (
          <div key={load.id} className="glass-card" style={{ padding: '24px', borderLeft: load.status==='blocked' ? '4px solid var(--red)' : '' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '800', fontSize: '16px' }}>Load #{load.id}</span>
                <span className={`badge ${load.priority==='high'?'red':'amber'}`}>{load.priority}</span>
                {load.tag && <span className={`badge ${load.status==='blocked'?'red':load.status==='needs_input'?'amber':'green'}`}>{load.tag}</span>}
              </div>
              <div className="val" style={{ fontSize: '22px', color: 'var(--green)' }}>${load.rate.toLocaleString()}</div>
            </div>
            <h3 style={{ marginBottom: '4px' }}>{load.pickup} ➔ {load.delivery}</h3>
            <p className="small" style={{ marginBottom: '16px' }}>{load.cargo} · {load.weight.toLocaleString()} lbs · {load.miles} mi · {load.deadline}</p>

            <ReturnBar prob={load.returnProb} />

            {/* === NEEDS INPUT: Choose between two drivers === */}
            {load.status === 'needs_input' && (
              <>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  {load.candidates.map(cid => {
                    const cd = DRIVERS.find(d => d.id === cid);
                    return <DriverCard key={cid} d={cd} selected={selectedDrivers[load.id] === cid} onClick={() => setSelectedDrivers(prev => ({...prev, [load.id]: cid}))} />;
                  })}
                </div>
                <button className="btn" disabled={!selectedDrivers[load.id]} onClick={() => onConfirm(load.id)}>
                  Confirm Selection
                </button>
              </>
            )}

            {/* === BLOCKED: Truck issue + alternative driver === */}
            {load.status === 'blocked' && (
              <>
                <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>{load.blockReason}</p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={() => onViewTwin(DRIVERS.find(d => d.id === load.driverId)?.truck || 'TRUCK-007')}>
                    View in Digital Twin →
                  </button>
                  <button className="btn secondary" onClick={() => setShowingAlt(prev => ({...prev, [load.id]: !prev[load.id]}))}>
                    Find Alternative Driver
                  </button>
                </div>
                {showingAlt[load.id] && (
                  <div style={{ background: 'rgba(57, 171, 212, 0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <Zap size={18} color="var(--blue)" />
                      <h4 style={{ color: 'var(--blue)', fontSize: '12px' }}>AI ALTERNATIVE — Predictive Dispatch Engine</h4>
                    </div>
                    {DRIVERS.filter(d => d.status === 'available' && d.id !== load.driverId).map(alt => (
                      <div key={alt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: alt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px', color: '#000' }}>{alt.initials}</div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>{alt.name}</div>
                            <div className="small">HOS {alt.hos}hrs · {alt.truck} · Score {alt.score}</div>
                          </div>
                        </div>
                        <button className="btn" style={{ padding: '6px 14px', fontSize: '10px' }} onClick={() => onConfirm(load.id)}>Reassign</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* === READY: AI recommendation with HOS warning === */}
            {load.status === 'ready' && driver && (
              <div className="ai-insight">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Zap size={20} color="var(--blue)" />
                  <h4 style={{ color: 'var(--blue)', fontSize: '12px' }}>AI RECOMMENDATION — Predictive Dispatch Engine</h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: driver.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>{driver.initials}</div>
                  <div>
                    <div style={{ fontWeight: '700' }}>{driver.name}</div>
                    <p className="small">{driver.location} — Denver 52% return load probability</p>
                  </div>
                </div>
                <ul style={{ fontSize: '12px', color: 'var(--green)', paddingLeft: '16px', marginBottom: '12px' }}>
                  {driver.reasons.map((r, i) => <li key={i} style={{ marginBottom: '2px' }}>{r}</li>)}
                </ul>

                {load.hosWarning && (
                  <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ color: 'var(--amber)', fontSize: '12px', fontWeight: '600' }}>
                      ⚠️ Insufficient HOS — 9.1hrs, need 10.0hrs. Relay recommended at Flagstaff.
                    </p>
                  </div>
                )}

                <button className="btn" onClick={() => onConfirm(load.id)}>Confirm Assignment</button>
              </div>
            )}
          </div>
        );
      })}
      {/* Live Load Inventory Table */}
      <div style={{ marginTop: '48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Live Fleet Inventory</h2>
          <span className="badge green" style={{ fontSize: '11px' }}>{loads.filter(l => l.status === 'assigned').length} ACTIVE UNITS</span>
        </div>
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 20px' }}>Driver</th>
                <th style={{ padding: '16px' }}>Truck</th>
                <th style={{ padding: '16px' }}>Type</th>
                <th style={{ padding: '16px' }}>Weight</th>
                <th style={{ padding: '16px' }}>Pickup ➔ Delivery</th>
                <th style={{ padding: '16px' }}>ETA / Arrival</th>
              </tr>
            </thead>
            <tbody>
              {loads.filter(l => l.status === 'assigned').map(load => {
                const driver = DRIVERS.find(d => d.id === load.driverId);
                return (
                  <tr key={load.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: driver?.color || 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px', color: '#000' }}>{driver?.initials}</div>
                        <strong>{driver?.name}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--blue)', fontWeight: '600' }}>{driver?.truck || 'N/A'}</td>
                    <td style={{ padding: '16px' }}>{load.cargo}</td>
                    <td style={{ padding: '16px' }}>{load.weight.toLocaleString()} lbs</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '500' }}>{load.pickup}</div>
                      <div className="small" style={{ color: 'var(--muted)' }}>➔ {load.delivery}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ color: 'var(--green)', fontWeight: '600' }}>{load.deadline}</div>
                      <div className="small" style={{ fontSize: '10px' }}>Tracking Active</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FleetTwin({ onReroute, initialTruckId = 'TRUCK-007' }) {
  const TRUCK_DB = {
    'TRUCK-007': { id: 'TRUCK-007', driver: 'Frank Chen', tireRL: 67, engine: 'OK', fuel: 34, hos: 1.8, brakes: 72 },
    'TRUCK-012': { id: 'TRUCK-012', driver: 'Raj Patel', tireRL: 94, engine: 'OK', fuel: 71, hos: 7.2, brakes: 91 },
    'TRUCK-009': { id: 'TRUCK-009', driver: 'Lisa Rodriguez', tireRL: 88, engine: 'OK', fuel: 56, hos: 5.4, brakes: 84 },
  };
  const [activeTruck, setActiveTruck] = useState(initialTruckId);
  const [truckData, setTruckData] = useState(TRUCK_DB[initialTruckId] || TRUCK_DB['TRUCK-007']);

  useEffect(() => {
    setActiveTruck(initialTruckId);
    setTruckData(TRUCK_DB[initialTruckId] || TRUCK_DB['TRUCK-007']);
  }, [initialTruckId]);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleReroute = () => {
    setTruckData(prev => ({ ...prev, tireRL: 90 }));
    showToast('✓ TRUCK-007 rerouted to Pilot TA #224 for emergency tire service. Dispatch board updated.');
    if (onReroute) onReroute();
  };

  const tireStatus = truckData.tireRL < 75 ? 'critical' : truckData.tireRL < 85 ? 'warning' : 'ok';
  const hosStatus = truckData.hos < 2 ? 'critical' : truckData.hos < 4 ? 'warning' : 'ok';
  const fuelStatus = truckData.fuel < 30 ? 'critical' : truckData.fuel < 50 ? 'warning' : 'ok';
  const brakeStatus = truckData.brakes < 50 ? 'critical' : truckData.brakes < 80 ? 'warning' : 'ok';

  const statusIcon = (s) => s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : '✅';
  const statusLabel = (s) => s === 'critical' ? 'FAIL' : s === 'warning' ? 'WARN' : 'OK';
  const statusColor = (s) => s === 'critical' ? 'var(--red)' : s === 'warning' ? 'var(--amber)' : 'var(--green)';

  return (
    <div className="twin-layout animate-fade" style={{ height: 'calc(100vh - 100px)' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: 'var(--card)', border: '1px solid var(--green)', borderLeft: '4px solid var(--green)', backdropFilter: 'blur(20px)', padding: '20px 24px', borderRadius: '12px', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'fadeUp 0.3s ease' }}>
          <p style={{ fontSize: '13px', fontWeight: '600' }}>{toast}</p>
        </div>
      )}

      <div className="canvas-wrapper">
        <Canvas camera={{ position: [8, 4, 10], fov: 45 }}>
          <Environment preset="city" />
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <TruckModel truckData={truckData} />
          <ContactShadows position={[0, -0.6, 0]} opacity={0.6} scale={20} blur={2} />
          <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.1} />
        </Canvas>
        {truckData.tireRL < 75 && (
          <div style={{ position: 'absolute', top: '32px', left: '32px', width: '320px' }} className="glass-card">
            <h4 style={{ color: 'var(--red)', marginBottom: '8px' }}>⚠️ CRITICAL TIRE EVENT</h4>
            <p style={{ fontWeight: '600' }}>TRUCK-007 · Rear Right Inner Dual</p>
            <p style={{ marginTop: '12px', fontSize: '13px', lineHeight: '1.5' }}>Tire pressure dropped to <strong>{truckData.tireRL} PSI</strong>. Blowout probability HIGH at highway speeds. Immediate reroute to nearest service center recommended.</p>
            <button className="btn" style={{ background: 'var(--red)', color: '#fff', width: '100%', marginTop: '16px' }} onClick={handleReroute}>
              REROUTE TO SERVICE
            </button>
          </div>
        )}
      </div>

      <div className="telemetry-side">
        <h2 style={{ marginBottom: '8px' }}>Unit Diagnostics</h2>
        <p className="small" style={{ marginBottom: '16px' }}>{truckData.id} · {truckData.driver}</p>

        {/* Truck Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {Object.keys(TRUCK_DB).map(tid => (
            <button key={tid} className={`btn ${tid === activeTruck ? '' : 'secondary'}`}
              style={{ padding: '6px 12px', fontSize: '10px', ...(tid === activeTruck && truckData.tireRL < 75 ? { background: 'var(--red)', color: '#fff' } : {}) }}
              onClick={() => { setActiveTruck(tid); setTruckData(TRUCK_DB[tid]); }}>
              {tid} {TRUCK_DB[tid].tireRL < 75 ? '🔴' : ''}
            </button>
          ))}
        </div>

        <div className="tm-row">
          <span className="tm-label">Rear Left Tire</span>
          <span className="tm-val">{truckData.tireRL} PSI</span>
          <span style={{ color: statusColor(tireStatus), fontSize: '12px', fontWeight: 700 }}>{statusIcon(tireStatus)} {statusLabel(tireStatus)}</span>
        </div>
        <div className="tm-row">
          <span className="tm-label">Engine Health</span>
          <span className="tm-val">{truckData.engine}</span>
          <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 700 }}>✅ OK</span>
        </div>
        <div className="tm-row">
          <span className="tm-label">HOS Remaining</span>
          <span className="tm-val">{truckData.hos} hrs</span>
          <span style={{ color: statusColor(hosStatus), fontSize: '12px', fontWeight: 700 }}>{statusIcon(hosStatus)} {statusLabel(hosStatus)}</span>
        </div>
        <div className="tm-row">
          <span className="tm-label">Fuel Level</span>
          <span className="tm-val">{truckData.fuel}%</span>
          <span style={{ color: statusColor(fuelStatus), fontSize: '12px', fontWeight: 700 }}>{statusIcon(fuelStatus)} {statusLabel(fuelStatus)}</span>
        </div>
        <div className="tm-row">
          <span className="tm-label">Brake Pad Life</span>
          <span className="tm-val">{truckData.brakes}%</span>
          <span style={{ color: statusColor(brakeStatus), fontSize: '12px', fontWeight: 700 }}>{statusIcon(brakeStatus)} {statusLabel(brakeStatus)}</span>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
          <button className="btn" style={{ background: 'var(--red)', color: '#fff', flex: 1 }} onClick={() => setTruckData(prev => ({...prev, tireRL: 67}))}>Simulate Fault</button>
          <button className="btn secondary" style={{ flex: 1 }} onClick={() => setTruckData(prev => ({...prev, tireRL: 94, hos: 7.2, fuel: 71, brakes: 91}))}>Reset Fleet</button>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// MAIN APP COMPONENT
// ====================================================================

export default function App() {
  const [activeTab, setActiveTab] = useState('dispatch');
  const [loads, setLoads] = useState(INITIAL_LOADS);
  const [twinTruckId, setTwinTruckId] = useState('TRUCK-007');

  const handleViewTwin = (truckId) => {
    setTwinTruckId(truckId);
    setActiveTab('twin');
  };

  useEffect(() => {
    document.body.style.backgroundImage = `url(${bgImage})`;
  }, []);

  const [alerts, setAlerts] = useState([
    { id:1, severity:"critical", loadId:307, driver:"Frank Chen", title:"Relay Needed — HOS Expiring", message:"Frank Chen hits HOS limit in 47 min. ETA 72 min. Delivery window at risk.", action:"Relay with Raj Patel · Exit 202 Tucson" }
  ]);

  const handleConfirmLoad = (id) => {
    setLoads(prev => prev.map(l => l.id === id ? { ...l, status: 'assigned' } : l));
  };

  const handleDismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const [showMap, setShowMap] = useState(false);

  return (
    <div className="app-container">
      {/* Tactical Map Overlay */}
      {showMap && (
        <div className="animate-fade" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '900px', height: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--blue)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--blue)' }}>Tactical Relay Overview</h3>
                <p className="small">Visualizing Relay Point: I-10 Exit 202 · Tucson, AZ</p>
              </div>
              <button className="btn secondary" onClick={() => setShowMap(false)}>Close Map</button>
            </div>
            <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', opacity: 0.9 }}>
              <MapContainer 
                center={[32.5, -109.5]} 
                zoom={6} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <Marker position={[33.4484, -112.0740]}>
                  <Popup>Phoenix: Unit-12 (Raj Patel)</Popup>
                </Marker>
                <Marker position={[31.7619, -106.4850]}>
                  <Popup>El Paso: Unit-09 (Lisa Rodriguez)</Popup>
                </Marker>
                <Marker position={[32.2226, -110.9747]}>
                  <Popup><strong>RELAY POINT: TUCSON</strong><br/>Unit-07 (Frank Chen)</Popup>
                </Marker>
              </MapContainer>

              <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 500, background: 'rgba(0,0,0,0.8)', padding: '12px', borderRadius: '8px', border: '1px solid var(--blue)' }}>
                <p className="small" style={{ color: 'var(--blue)' }}>● LIVE OSM FEED ACTIVE</p>
                <p className="small" style={{ color: 'var(--muted)' }}>Region: SW - US (AZ/TX)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar">
        <div className="brand"><h1>Load Lorry</h1><p className="small" style={{ color: 'var(--green)' }}>● LIVE FLEET</p></div>
        <nav>
          {[
            { id: 'dispatch', label: 'Smart Dispatch', icon: <LayoutDashboard size={18} /> },
            { id: 'twin',     label: '3D Digital Twin', icon: <Truck size={18} /> },
            { id: 'alerts',   label: 'Live Alerts',    icon: <AlertCircle size={18} />, badge: alerts.length > 0 ? alerts.length.toString() : null },
            { id: 'billing',  label: 'Billing Pipeline', icon: <FileText size={18} /> },
            { id: 'cost',     label: 'Cost Intelligence', icon: <TrendingUp size={18} /> },
          ].map(item => (
            <div key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>{item.icon}{item.label}</div>
              {item.badge && <span className="badge red">{item.badge}</span>}
            </div>
          ))}
        </nav>
      </div>

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div><p className="small">Operations Console</p><h4>{new Date().toDateString()}</h4></div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} /></div>
        </header>

        {activeTab === 'dispatch' && <DispatchBoard loads={loads} onConfirm={handleConfirmLoad} onViewTwin={handleViewTwin} />}
        {activeTab === 'twin' && <FleetTwin initialTruckId={twinTruckId} />}
        {activeTab === 'alerts' && (
          <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>Live Alert Feed</h2>
              {alerts.length > 0 && <span className="badge red" style={{ fontSize: '11px' }}>{alerts.length} UNRESOLVED</span>}
            </div>
            
            {alerts.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '64px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>🛡️</div>
                <h3>All Systems Clear</h3>
                <p className="small">No active critical alerts in the fleet queue.</p>
              </div>
            ) : (
              alerts.map(a => (
                <div key={a.id} className="glass-card" style={{ borderLeft: '4px solid var(--red)', padding: '24px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span className="badge red" style={{ letterSpacing: '1px' }}>{a.severity.toUpperCase()}</span>
                    <span className="small" style={{ color: 'var(--muted)' }}>3 min ago</span>
                  </div>
                  <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>{a.title}</h3>
                  <p style={{ marginBottom: '16px', color: 'rgba(208, 221, 231, 0.8)' }}>{a.message}</p>
                  
                  <div className="ai-insight" style={{ marginBottom: '20px', background: 'rgba(57, 171, 212, 0.05)', borderColor: 'var(--blue)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <Zap size={16} color="var(--blue)" />
                      <strong style={{ fontSize: '11px', color: 'var(--blue)', letterSpacing: '0.5px' }}>AI RECOMMENDED ACTION</strong>
                    </div>
                    <p style={{ fontSize: '13px' }}>{a.action}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn" style={{ background: 'var(--green)', color: '#000' }} onClick={() => {
                      alert("Relay Approved: Dispatching Raj Patel to Exit 202 Tucson.");
                      handleDismissAlert(a.id);
                    }}>Approve Relay & Reroute</button>
                    <button className="btn secondary" onClick={() => handleDismissAlert(a.id)}>Dismiss Alert</button>
                    <button className="btn secondary" style={{ border: 'none', background: 'transparent' }} onClick={() => setShowMap(true)}>View Logistics Map →</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'billing' && <BillingPipeline />}
        {activeTab === 'cost' && <CostIntelligence />}
      </main>
    </div>
  );
}

// ====================================================================
// BILLING PIPELINE — OCR Document Scanner
// ====================================================================
const INITIAL_HISTORY = [
  { load: '#303', driver: 'Patel', route: 'PHX→HOU', invoice: '$3,650', margin: '$892', status: 'PAID ✓', time: '2hrs ago' },
  { load: '#302', driver: 'Rodriguez', route: 'TUC→ELP', invoice: '$1,920', margin: '$287', status: 'SENT', time: '5hrs ago' },
  { load: '#301', driver: 'Johnson', route: 'PHX→DEN', invoice: '$2,980', margin: '$398', status: 'PAID ✓', time: '8hrs ago' },
  { load: '#300', driver: 'Chen', route: 'PHX→DAL', invoice: '$2,840', margin: '$241', status: 'SENT', time: 'Yesterday' },
  { load: '#299', driver: 'Sharma', route: 'MSA→LAX', invoice: '$3,200', margin: '$567', status: 'PAID ✓', time: 'Yesterday' },
];

const LOAD_QUEUE = [
  { id: '#304', driver: 'Frank Chen', route: 'PHX→DAL', invoiceAmt: '$2,982', marginAmt: '$241', ocrLines: [
    '📄 Scanning Bill of Lading...', '   Load ID: #304', '   Shipper: Phoenix Industrial Supply Co.', '   Consignee: Dallas Freight Terminal', '   Weight: 42,000 lbs', '   Commodity: Industrial Equipment', '',
    '📄 Scanning Proof of Delivery...', '   Delivery confirmed: Apr 18, 2026 14:23', '   Signed by: R. Martinez (Dock #7)', '   Condition: No damage noted', '',
    '📄 Scanning Fuel Receipt...', '   Pilot TA #224, Flagstaff AZ', '   Diesel: 87.3 gal @ $4.72/gal = $412.06', '   DEF: 2.1 gal @ $3.89/gal = $8.17', '   Total fuel cost: $420.23', '',
    '🔗 Cross-referencing with rate confirmation...', '   Contracted rate: $2,840.00', '   Fuel surcharge: $142.00', '   Total invoice: $2,982.00', '',
    '⚠️  Variance: Fuel $47.40 over estimate (unplanned stop)', '✅ Within threshold (±$60)', '✅ Invoice #INV-2026-0304 generated',
  ]},
  { id: '#305', driver: 'Lisa Rodriguez', route: 'TUC→ELP', invoiceAmt: '$1,920', marginAmt: '$287', ocrLines: [
    '📄 Scanning Bill of Lading...', '   Load ID: #305', '   Shipper: Tucson Distribution Center', '   Consignee: El Paso Logistics Hub', '   Weight: 38,000 lbs', '   Commodity: Retail Goods', '',
    '📄 Scanning Proof of Delivery...', '   Delivery confirmed: Apr 19, 2026 09:41', '   Signed by: J. Alvarez (Bay #3)', '   Condition: No damage noted', '',
    '📄 Scanning Fuel Receipt...', '   Love\'s Travel Stop #482, Deming NM', '   Diesel: 54.1 gal @ $4.68/gal = $253.19', '   Total fuel cost: $253.19', '',
    '🔗 Cross-referencing with rate confirmation...', '   Contracted rate: $1,920.00', '   Fuel surcharge: $0.00', '   Total invoice: $1,920.00', '',
    '✅ No variance detected', '✅ Invoice #INV-2026-0305 generated',
  ]},
  { id: '#308', driver: 'Marcus Johnson', route: 'PHX→DEN', invoiceAmt: '$2,980', marginAmt: '$398', ocrLines: [
    '📄 Scanning Bill of Lading...', '   Load ID: #308', '   Shipper: Phoenix Chemical Corp', '   Consignee: Denver Industrial Park', '   Weight: 44,000 lbs', '   Commodity: Chemical Supplies', '',
    '📄 Scanning Proof of Delivery...', '   Delivery confirmed: Apr 19, 2026 11:17', '   Signed by: T. Williams (Dock #12)', '   Condition: Sealed — no damage', '',
    '📄 Scanning Fuel Receipt...', '   Pilot TA #118, Albuquerque NM', '   Diesel: 72.8 gal @ $4.74/gal = $345.07', '   Total fuel cost: $345.07', '',
    '🔗 Cross-referencing with rate confirmation...', '   Contracted rate: $2,980.00', '   Fuel surcharge: $89.00', '   Total invoice: $3,069.00', '',
    '✅ No variance detected', '✅ Invoice #INV-2026-0308 generated',
  ]},
];

function BillingPipeline() {
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [currentLoadIdx, setCurrentLoadIdx] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState({ bol: false, pod: false, fuel: false });
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [totalInvoiced, setTotalInvoiced] = useState(23);

  const currentLoad = LOAD_QUEUE[currentLoadIdx] || LOAD_QUEUE[0];
  const allDone = currentLoadIdx >= LOAD_QUEUE.length;

  // Derive load card statuses dynamically
  const loadCards = LOAD_QUEUE.map((lq, i) => {
    let status, color;
    if (i < currentLoadIdx) { status = 'INVOICED ✓'; color = 'var(--green)'; }
    else if (i === currentLoadIdx && stage !== 'idle') { status = 'PROCESSING'; color = 'var(--amber)'; }
    else if (i === currentLoadIdx) { status = 'AWAITING DOCS'; color = 'var(--blue)'; }
    else { status = 'QUEUED'; color = 'var(--muted)'; }
    return { id: lq.id, status, driver: lq.driver, color };
  });

  const handleFileClick = (docType) => () => {
    setUploadedDocs(prev => ({ ...prev, [docType]: true }));
  };

  const runDemo = () => {
    setUploadedDocs({ bol: true, pod: true, fuel: true });
    setTimeout(() => startScan(), 300);
  };

  const startScan = () => {
    setStage('scanning');
    setProgress(0);
    setOcrText('');
    const lines = currentLoad.ocrLines;
    let lineIdx = 0;
    const interval = setInterval(() => {
      if (lineIdx >= lines.length) {
        clearInterval(interval);
        setStage('extracted');
        return;
      }
      setOcrText(prev => prev + lines[lineIdx] + '\n');
      setProgress(Math.min(100, Math.round(((lineIdx + 1) / lines.length) * 100)));
      lineIdx++;
    }, 120);
  };

  const finalize = () => {
    // Add to history
    const newEntry = {
      load: currentLoad.id,
      driver: currentLoad.driver.split(' ')[1] || currentLoad.driver,
      route: currentLoad.route,
      invoice: currentLoad.invoiceAmt,
      margin: currentLoad.marginAmt,
      status: 'SENT',
      time: 'Just now',
    };
    setHistory(prev => [newEntry, ...prev]);
    setTotalInvoiced(prev => prev + 1);
    setStage('done');
  };

  const processNext = () => {
    setCurrentLoadIdx(prev => prev + 1);
    setStage('idle');
    setUploadedDocs({ bol: false, pod: false, fuel: false });
    setOcrText('');
    setProgress(0);
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2>Billing & Documentation</h2>
          <p>Document upload → AI extraction → Invoice in seconds</p>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 20px', fontSize: '12px', textAlign: 'right' }}>
          <span style={{ color: 'var(--muted)' }}>{totalInvoiced} loads invoiced · $67,340 revenue · $13,060 margin</span><br/>
          <span style={{ color: 'var(--muted)' }}>avg 12s invoice time</span>
        </div>
      </div>

      {/* Load Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {loadCards.map((lc, i) => (
          <div key={i}
            style={{ background: 'var(--card)', border: i === currentLoadIdx ? `2px solid ${lc.color}` : '1px solid var(--border)', borderRadius: '12px', padding: '16px', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>Load {lc.id}</div>
            <div style={{ fontSize: '11px', color: lc.color, textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginTop: '4px' }}>{lc.status}</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{lc.driver}</div>
          </div>
        ))}
      </div>

      {/* Upload Zones — only when idle and loads remain */}
      {stage === 'idle' && !allDone && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[
              { key: 'bol', label: 'Bill of Lading', icon: '📋' },
              { key: 'pod', label: 'Proof of Delivery', icon: '📦' },
              { key: 'fuel', label: 'Fuel Receipt', icon: '⛽' },
            ].map(doc => (
              <div key={doc.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setUploadedDocs(prev => ({...prev, [doc.key]: true})); }}
                onClick={handleFileClick(doc.key)}
                style={{ border: uploadedDocs[doc.key] ? '2px solid var(--green)' : '2px dashed rgba(208, 221, 231, 0.2)', borderRadius: '12px', padding: '32px 16px', textAlign: 'center', cursor: 'pointer', background: uploadedDocs[doc.key] ? 'rgba(74, 222, 128, 0.05)' : 'transparent', transition: 'all 0.3s' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{uploadedDocs[doc.key] ? '✅' : doc.icon}</div>
                <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>{doc.label}</div>
                <div style={{ fontSize: '11px', color: uploadedDocs[doc.key] ? 'var(--green)' : 'var(--muted)' }}>{uploadedDocs[doc.key] ? 'Uploaded' : 'Drop or click'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            <button className="btn" onClick={startScan}>⇒ Process Documents with AI</button>
            <button className="btn secondary" onClick={runDemo}>▶ Run Demo (skip upload)</button>
          </div>
        </>
      )}

      {/* All processed state */}
      {stage === 'idle' && allDone && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ color: 'var(--green)', marginBottom: '8px' }}>All Loads Processed</h3>
          <p>All queued loads have been invoiced. New loads will appear as drivers complete deliveries.</p>
        </div>
      )}

      {/* OCR Terminal */}
      {stage === 'scanning' && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', height: '6px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.1s linear', borderRadius: '8px' }} />
          </div>
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', fontFamily: "'Courier New', monospace", fontSize: '12px', color: 'var(--green)', lineHeight: '1.8', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
            {ocrText}<span style={{ opacity: progress < 100 ? 1 : 0 }}>▌</span>
          </div>
        </div>
      )}

      {/* Extraction Result */}
      {stage === 'extracted' && (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3>OCR Extraction Complete — Invoice #INV-2026-{currentLoad.id.replace('#','0')}</h3>
            <span className="badge green">READY</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {[{ l: 'Load', v: currentLoad.id }, { l: 'Route', v: currentLoad.route }, { l: 'Invoice', v: currentLoad.invoiceAmt, c: 'var(--green)' }, { l: 'Margin', v: currentLoad.marginAmt, c: 'var(--green)' }].map((f, i) => (
              <div key={i} className="tm-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <span className="tm-label">{f.l}</span>
                <span className="tm-val" style={{ color: f.c || '#fff' }}>{f.v}</span>
              </div>
            ))}
          </div>
          <button className="btn" onClick={finalize}>Approve & Send Invoice</button>
        </div>
      )}

      {/* Done — with "Process Next" */}
      {stage === 'done' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', marginBottom: '24px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(74, 222, 128, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>✓</div>
          <h3 style={{ color: 'var(--green)', marginBottom: '8px' }}>Invoice Sent — Load {currentLoad.id}</h3>
          <p className="small" style={{ marginBottom: '20px' }}>{currentLoad.invoiceAmt} → billing sent · Net-30</p>
          {currentLoadIdx < LOAD_QUEUE.length - 1 ? (
            <button className="btn" onClick={processNext}>Process Next Load →</button>
          ) : (
            <button className="btn" onClick={processNext}>Finish Queue</button>
          )}
        </div>
      )}

      {/* Billing History Table */}
      <h3 style={{ marginBottom: '16px' }}>Billing History</h3>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['LOAD', 'DRIVER', 'ROUTE', 'INVOICE', 'MARGIN', 'STATUS', 'TIME'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '800', color: 'var(--muted)', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: row.time === 'Just now' ? 'rgba(57, 171, 212, 0.05)' : 'transparent' }}>
                <td style={{ padding: '14px 16px', fontWeight: '700' }}>{row.load}</td>
                <td style={{ padding: '14px 16px' }}>{row.driver}</td>
                <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '12px' }}>{row.route}</td>
                <td style={{ padding: '14px 16px', fontWeight: '600' }}>{row.invoice}</td>
                <td style={{ padding: '14px 16px', color: 'var(--green)' }}>{row.margin}</td>
                <td style={{ padding: '14px 16px' }}><span style={{ color: row.status.includes('PAID') ? 'var(--green)' : row.time === 'Just now' ? 'var(--blue)' : 'var(--muted)', fontWeight: '600', fontSize: '12px' }}>{row.status}</span></td>
                <td style={{ padding: '14px 16px', color: row.time === 'Just now' ? 'var(--blue)' : 'var(--muted)', fontSize: '12px', fontWeight: row.time === 'Just now' ? '700' : '400' }}>{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====================================================================
// COST INTELLIGENCE
// ====================================================================
function CostIntelligence() {
  const weekData = [
    { label: 'Mon', revenue: 12400, cost: 9800 },
    { label: 'Tue', revenue: 15200, cost: 11200 },
    { label: 'Wed', revenue: 11800, cost: 10400 },
    { label: 'Thu', revenue: 14600, cost: 11000 },
    { label: 'Fri', revenue: 13340, cost: 10900 },
  ];
  const maxVal = Math.max(...weekData.map(d => d.revenue));

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px' }}>
        <h2>Cost Intelligence</h2>
        <p>Automated 3-way P&L reconciliation with AI narrative</p>
      </div>

      <div className="stat-row">
        <div className="stat-card"><h3>Total Revenue</h3><div className="val" style={{color:'var(--green)'}}>$67,340</div></div>
        <div className="stat-card"><h3>Net Margin</h3><div className="val" style={{color:'var(--green)'}}>$13,060</div></div>
        <div className="stat-card"><h3>Margin %</h3><div className="val" style={{color:'var(--blue)'}}>19.4%</div></div>
        <div className="stat-card"><h3>vs Last Week</h3><div className="val" style={{color:'var(--red)'}}>-$2,340</div></div>
      </div>

      {/* Simple Bar Chart */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '20px' }}>Weekly Revenue vs Cost</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '180px', padding: '0 8px' }}>
          {weekData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: '150px' }}>
                <div style={{ width: '35%', height: `${(d.revenue / maxVal) * 140}px`, background: 'var(--blue)', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} />
                <div style={{ width: '35%', height: `${(d.cost / maxVal) * 140}px`, background: 'rgba(208, 221, 231, 0.3)', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} />
              </div>
              <span className="small">{d.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--blue)' }} /><span className="small">Revenue</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(208, 221, 231, 0.3)' }} /><span className="small">Cost</span></div>
        </div>
      </div>

      <div className="ai-insight" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <TrendingUp size={20} color="var(--blue)" />
          <h4 style={{ color: 'var(--blue)' }}>AI PROFITABILITY ANALYSIS — Week of April 14–18</h4>
        </div>
        <p style={{ lineHeight: '1.7', marginBottom: '16px' }}>
          This week: <strong>23 loads completed</strong>. Net margin <strong>$13,060</strong> — down <strong style={{ color: 'var(--red)' }}>$2,340</strong> from last week.
        </p>
        <p style={{ lineHeight: '1.7', marginBottom: '16px' }}>
          <strong>Primary driver:</strong> 3 loads on the Phoenix–Flagstaff corridor ran 18% over baseline fuel cost due to unplanned stops. 
          <strong> Secondary:</strong> Driver Chen's HOS rest stops on I-40 added 94 unnecessary deadhead miles.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div className="tm-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', borderLeft: '3px solid var(--red)' }}>
            <span className="badge red">#1 CAUSE — 68% OF DROP</span>
            <p style={{ fontSize: '13px' }}><strong>Phoenix–Flagstaff corridor</strong> — 3 loads, $890 excess fuel</p>
            <p style={{ fontSize: '12px', color: 'var(--green)' }}>✓ Fix: Pre-plan fuel at Pilot TA #224 → saves $71/run ($852/mo)</p>
          </div>
          <div className="tm-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', borderLeft: '3px solid var(--amber)' }}>
            <span className="badge amber">#2 CAUSE — 32% OF DROP</span>
            <p style={{ fontSize: '13px' }}><strong>Driver Chen I-40 stops</strong> — 94 deadhead miles, $127 excess</p>
            <p style={{ fontSize: '12px', color: 'var(--green)' }}>✓ Fix: Pre-plan rest at Kingman TA → saves $508/mo</p>
          </div>
        </div>
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(74, 222, 128, 0.08)', borderRadius: '10px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
          <p style={{ color: 'var(--green)', fontWeight: '700' }}>Projected recovery if both fixes implemented: <strong>$1,360/week ($5,440/month)</strong></p>
        </div>
      </div>
    </div>
  );
}
