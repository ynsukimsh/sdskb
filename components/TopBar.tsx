import Link from 'next/link'
import Image from 'next/image'
import solidLogo from '@/asset/images/solid_logo_blue.png'

export default function TopBar() {
  return (
    <header
      className={
        'fixed top-0 left-0 right-0 z-20 h-12 ' +
        'border-b border-white/20 ' +
        'flex items-center justify-between px-6 ' +
        'bg-white/50 dark:bg-gray-900/50 backdrop-blur-md'
      }
    >
      <Link href="/" className="flex items-center gap-2 font-bold text-black">
        <Image
          src={solidLogo}
          alt="SOLID Design"
          width={120}
          height={32}
          className="h-4 w-auto"
          priority
        />
        SOLID Design
      </Link>

      <button className="px-4 py-0.5 text-black text-sm">
        LOGIN
      </button>
    </header>
  )
}