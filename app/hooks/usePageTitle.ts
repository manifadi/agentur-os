import { useEffect } from 'react';

export function usePageTitle(title: string) {
    useEffect(() => {
        document.title = title ? `Vela | ${title}` : 'Vela';
        return () => { document.title = 'Vela'; };
    }, [title]);
}
