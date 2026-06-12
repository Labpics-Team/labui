// Server Component (no 'use client'): the page shell is server-rendered; the
// interactive Button matrix is the client leaf. This is the RSC boundary
// discipline — server by default, client by exception.
import { ButtonMatrix } from '../../shared/button-matrix';

export default function Page() {
  return <ButtonMatrix />;
}
