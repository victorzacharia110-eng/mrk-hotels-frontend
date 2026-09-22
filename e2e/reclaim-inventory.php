<?php

// Reclaim today/tomorrow inventory for e2e QA: soft-delete demo/leftover
// reservations that block today's and tomorrow's board cells.
// Run: php artisan tinker /home/victor/Documents/Projects/Frontends/VueFrontends/mrk-hotels-frontend/e2e/reclaim-inventory.php

$t = App\Models\Core\Tenant::where('subdomain', 'mrk-grand')->first();
if (! $t) {
    echo "no tenant\n";
    return;
}
$today = \Carbon\Carbon::today();
$tomorrow = $today->copy()->addDay();

// (a) reservations blocking today/tomorrow cells, and
// (b) stale "zombie" residents (status checked_in but check_out already past)
//     that never checked out and permanently block the check-in guard.
$ids = \DB::table('reservations')
    ->where('tenant_id', $t->tenant_id)
    ->whereNull('deleted_at')
    ->where(function ($q) use ($today, $tomorrow) {
        $q->where(function ($w) use ($today, $tomorrow) {
            $w->where('check_in_date', '<=', $tomorrow->toDateString())
                ->where('check_out_date', '>', $today->toDateString());
        })->orWhere(function ($w) use ($today) {
            $w->where('status', 'checked_in')
                ->where('check_out_date', '<=', $today->toDateString());
        });
    })
    ->pluck('reservation_id');

echo 'reclaiming ' . $ids->count() . " reservations (today/tomorrow blocks + stale residents)\n";

foreach ($ids as $id) {
    App\Models\Hotel\Reservation::where('reservation_id', $id)->delete();
}