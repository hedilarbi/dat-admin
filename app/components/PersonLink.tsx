import Link from 'next/link';

interface PersonLinkProps {
  /** Identifiant du compte ; sans lui, le nom s'affiche en simple texte. */
  id?: string | null;
  role: 'acheteur' | 'vendeur';
  name: string;
  className?: string;
}

/**
 * Nom d'un acheteur ou d'un vendeur qui ouvre sa fiche (coordonnées, documents) dans un nouvel
 * onglet, pour ne pas quitter la liste ou la vente en cours de consultation.
 */
export default function PersonLink({ id, role, name, className = '' }: PersonLinkProps) {
  if (!id) return <>{name}</>;
  return (
    <Link
      href={`/inscription/${role}/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={`underline decoration-[#d9704f] decoration-2 underline-offset-2 hover:text-[#d9704f] ${className}`}
    >
      {name}
    </Link>
  );
}
