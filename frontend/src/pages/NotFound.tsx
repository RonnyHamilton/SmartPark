import { ArrowLeft, Compass, MapPinOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-slate-50 px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
          <MapPinOff className="h-6 w-6" />
        </span>
        <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-slate-500">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Page Not Found</h1>
        <p className="mx-auto mt-2 text-xs leading-relaxed text-slate-500">
          The requested route or reservation link does not exist. Navigate back to discovery to browse available locations.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/discover">
            <Button size="sm" icon={Compass}>Browse Facilities</Button>
          </Link>
          <Link to="/">
            <Button size="sm" variant="outline" icon={ArrowLeft}>Home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
