import { Result, Button } from 'antd';
import { Link, useLocation } from 'react-router-dom';

export default function Unauthorized() {
  const location = useLocation();
  return (
    <Result
      status="403"
      title="Unauthorized"
      subTitle="You do not have permission to access this page with your current role."
      extra={
        <Link to="/dashboard" state={{ from: location }}>
          <Button type="primary">Go to Dashboard</Button>
        </Link>
      }
    />
  );
}


