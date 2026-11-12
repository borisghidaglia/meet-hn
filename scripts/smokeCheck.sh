#!/bin/bash
# Release smoke checks (read-only GETs). Usage: scripts/smokeCheck.sh [base-url]
# Expected after the city migration (counts can grow with new sign-ups):
#   home ~920 pages on the map; old New York pin and us-New York → 308 /city/R175905;
#   R175905 ~27 hackers, R1543125 (Tokyo) ~8, R71525 (Paris) ~38; fr-Paris → 308 /city/R71525;
#   Málaga city R340746 and province R5275848 both 200 (separate pages); unknown id 404.
B=${1:-https://meet.hn}
code() { curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "$B$1"; }
hackers() { curl -s "$B$1" | sed 's/<[^>]*>/ /g' | tr -s ' ' | grep -o '[0-9]* hackers\? in [^,]*' | head -1; }
echo "home            $(code /)  pages on map: $(curl -s "$B/" | grep -o '\\"hackers\\":' | wc -l | tr -d ' ')"
echo "NY old pin      $(code '/city/40.6526006,-73.9497211')"
echo "NY R175905      $(code /city/R175905)  $(hackers /city/R175905)"
echo "us-New York     $(code '/city/us-New%20York')"
echo "Tokyo R1543125  $(code /city/R1543125)  $(hackers /city/R1543125)"
echo "Paris R71525    $(code /city/R71525)  $(hackers /city/R71525)"
echo "fr-Paris        $(code /city/fr-Paris)"
echo "?city=fr-Paris  $(code '/?city=fr-Paris')"
echo "Malaga          city $(code /city/R340746)  province $(code /city/R5275848)"
echo "unknown id      $(code /city/R999999999999)"
