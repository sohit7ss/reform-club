import {useAuth} from '../context/AuthContext.jsx'
export function usePermission(p){ const {can,isAdmin}=useAuth(); return isAdmin && can(p) }
export default usePermission
