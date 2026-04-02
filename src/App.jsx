import { Routes, Route, Navigate } from 'react-router';
import { InputPage } from './components/pages/InputPage';
import { WallPage } from './components/pages/WallPage';
import { VisionsPage } from './components/pages/VisionsPage';

export function App() {
  return (
    <Routes>
      <Route path="/input" element={<InputPage />} />
      <Route path="/wall" element={<WallPage />} />
      <Route path="/visions" element={<VisionsPage />} />
      <Route path="*" element={<Navigate to="/wall" replace />} />
    </Routes>
  );
}
