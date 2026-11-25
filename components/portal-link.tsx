import type {AnchorHTMLAttributes} from 'react';

/** Cross-page navigation must work independently of the client router. */
export default function PortalLink({children,target='_top',...props}:AnchorHTMLAttributes<HTMLAnchorElement>){
 return <a {...props} target={target}>{children}</a>;
}
