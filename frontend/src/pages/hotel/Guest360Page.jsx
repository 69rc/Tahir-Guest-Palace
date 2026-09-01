import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Phone, Mail, MapPin, Save } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Badge, Card, CardHeader, Button, PageLoader, Stat } from '../../components/ui/index.jsx';
import { naira, fmtDate, initials } from '../../utils/format.js';

export default function Guest360Page() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefForm, setPrefForm] = useState(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/guests/${id}/guest360`);
      setData(res.data);
      setPrefForm(res.data.prefs || { room_preference: '', bed_preference: '', smoking_preference: '', food_preferences: '', special_requests: '', other_notes: '' });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const savePrefs = async () => {
    setSaving(true);
    try {
      await api.put(`/guests/${id}/preferences`, prefForm);
      toast.success('Preferences saved');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;
  if (!data) return <p className="text-ink-500">Guest not found.</p>;

  const { guest, currentReservation, stayHistory, stayStats, folio, spending } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/guests" className="btn-ghost !p-2"><ArrowLeft size={18} /></Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-900">GUEST 360</h1>
            {guest.vip_status === 'VIP' && <Badge status="CANCELLED">VIP ⭐</Badge>}
          </div>
          <p className="text-sm text-ink-500 mt-0.5">{guest.full_name}</p>
        </div>
      </div>

      {/* Profile */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold">{initials(guest.full_name)}</div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink-900">{guest.full_name}</p>
            <p className="text-sm text-ink-500">{guest.guest_type} · {guest.country}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600 mt-1">
              <span className="flex items-center gap-1"><Phone size={12} /> {guest.phone || '—'}</span>
              <span className="flex items-center gap-1"><Mail size={12} /> {guest.email || '—'}</span>
              <span className="flex items-center gap-1"><MapPin size={12} /> {guest.address || '—'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Current Stay */}
      {currentReservation ? (
        <Card className="p-5 border-blue-200 bg-blue-50/40">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Current Stay</p>
          <div className="flex flex-wrap items-center justify-between mt-1">
            <p className="text-lg font-bold text-ink-900">Room {currentReservation.room_number} <span className="text-sm font-normal text-ink-500">({currentReservation.room_type})</span></p>
            <p className="text-sm text-ink-700 font-medium">{fmtDate(currentReservation.check_in_date)} → {fmtDate(currentReservation.check_out_date)}</p>
          </div>
          <Badge status={currentReservation.status}>{currentReservation.status}</Badge>
        </Card>
      ) : (
        <Card className="p-5 text-ink-500"><p className="text-sm">No current stay.</p></Card>
      )}

      {/* Current Folio */}
      <Card>
        <CardHeader title="CURRENT FOLIO" />
        <div className="p-5 space-y-1 text-sm">
          {folio && (
            <>
              {folio.roomTotal > 0 && <div className="flex justify-between"><span>Room</span><span className="font-medium">{naira(folio.roomTotal)}</span></div>}
              {folio.restaurantTotal > 0 && <div className="flex justify-between"><span>Restaurant</span><span className="font-medium">{naira(folio.restaurantTotal)}</span></div>}
              {folio.spaTotal > 0 && <div className="flex justify-between"><span>Spa</span><span className="font-medium">{naira(folio.spaTotal)}</span></div>}
              {folio.barbershopTotal > 0 && <div className="flex justify-between"><span>Barbershop</span><span className="font-medium">{naira(folio.barbershopTotal)}</span></div>}
              {folio.amenityTotal > 0 && <div className="flex justify-between"><span>Other services</span><span className="font-medium">{naira(folio.amenityTotal)}</span></div>}
              {folio.eventTotal > 0 && <div className="flex justify-between"><span>Events</span><span className="font-medium">{naira(folio.eventTotal)}</span></div>}
              {folio.otherTotal > 0 && <div className="flex justify-between"><span>Other</span><span className="font-medium">{naira(folio.otherTotal)}</span></div>}
              <div className="flex justify-between font-bold border-t border-ink-100 pt-2 mt-1"><span>Total</span><span>{naira(folio.totalCharges)}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>{naira(folio.totalPaid)}</span></div>
              <div className={`flex justify-between font-bold ${folio.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}><span>Balance</span><span>{naira(folio.balance)}</span></div>
            </>
          )}
        </div>
      </Card>

      {/* Stay History + Spending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="STAY HISTORY" subtitle={`${stayStats.previousStays} stays · ${stayStats.totalNights} nights`} />
          <div className="p-3">
            {stayHistory.length === 0 ? (
              <p className="text-sm text-ink-500 p-2">No stays recorded.</p>
            ) : (
              <div className="divide-y divide-ink-100">
                {stayHistory.slice(0, 8).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-2 text-sm">
                    <div>
                      <p className="font-medium">Room {s.room_number}</p>
                      <p className="text-xs text-ink-500">{fmtDate(s.check_in_date)} → {fmtDate(s.check_out_date)}</p>
                    </div>
                    <Badge status={s.status}>{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="LIFETIME SPENDING" />
          <div className="p-5 space-y-1 text-sm">
            <div className="flex justify-between"><span>Room</span><span className="font-medium">{naira(spending.room)}</span></div>
            <div className="flex justify-between"><span>Restaurant</span><span className="font-medium">{naira(spending.restaurant)}</span></div>
            <div className="flex justify-between"><span>Services</span><span className="font-medium">{naira(spending.services)}</span></div>
            {spending.event > 0 && <div className="flex justify-between"><span>Events</span><span className="font-medium">{naira(spending.event)}</span></div>}
            <div className="flex justify-between font-bold border-t border-ink-100 pt-2 mt-1"><span>Lifetime</span><span>{naira(spending.lifetime)}</span></div>
          </div>
        </Card>
      </div>

      {/* Preferences */}
      <Card>
        <CardHeader title="PREFERENCES" action={<Button variant="secondary" size="sm" onClick={savePrefs} loading={saving}><Save size={14} /> Save</Button>} />
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['room_preference', 'Room Preference'],
            ['bed_preference', 'Bed Preference'],
            ['smoking_preference', 'Smoking Preference'],
            ['food_preferences', 'Food Preferences'],
            ['special_requests', 'Special Requests'],
            ['other_notes', 'Other Notes'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" value={prefForm?.[key] || ''} onChange={(e) => setPrefForm({ ...prefForm, [key]: e.target.value })} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
