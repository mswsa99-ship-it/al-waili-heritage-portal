import {requireSessionUser} from '@/app/session-auth';
import {getFamilyActor} from '@/lib/family-access';
import {redirect} from 'next/navigation';
import {query} from '@/lib/site-db';
import PortalClient from '@/app/portal/portal-client';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Admin(){await requireSessionUser('/admin');const actor=await getFamilyActor();const delegated=actor?.personId?await query("SELECT id FROM lineage_work_delegations WHERE delegate_person_id=? AND status='active' AND (expires_at IS NULL OR expires_at='' OR expires_at>?) LIMIT 1",actor.personId,new Date().toISOString()).first():null;if(!actor||(!delegated&&!['central','genealogy','branch','council','secretary','social','oversight'].includes(actor.role)))redirect('/member/dashboard');return <PortalClient mode="administration"/>;}
