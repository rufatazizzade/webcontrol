import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TargetClient from './pages/TargetClient';
import OperatorDashboard from './pages/OperatorDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TargetClient />} />
        <Route path="/operator" element={<OperatorDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
