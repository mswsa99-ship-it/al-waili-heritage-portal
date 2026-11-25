import {requireSessionUser} from '@/app/session-auth';
import PortalClient from '@/app/portal/portal-client';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Page(){await requireSessionUser('/member/dashboard');return <PortalClient section="dashboard"/>;}
