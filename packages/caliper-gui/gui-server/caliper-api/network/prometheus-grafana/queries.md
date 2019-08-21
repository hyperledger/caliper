#Some useful things!

TPS/latency rate guages: 
 - sum(caliper_tps{instance=~".+", round=~".+"}) by (instance, round)  will yield a gauge for each test label and round, in real time
 - avg(caliper_latency{instance=~".+", round=~".+"}) by (instance, round)


End of test stats
- average latency over the specified time priod for a named test label (instance) and round number
    avg(caliper_latency{client=~".+", instance="init", round="0"})


- average TPS over the specified time


## Resource

grab a named containser via {name="x"}

sum(rate(container_cpu_usage_seconds_total{name=~"peer.+"}[$interval])) by (name) * 100    === CPU use
container_memory_usage_bytes{name=~".+"}  === memory (current)


container_memory_max_usage_bytes max memory
sum(rate(container_network_receive_bytes_total{id=\"/\"}[$interval])) by (id)   network recieve
sum(rate(container_network_transmit_bytes_total{id=\"/\"}[$interval])) by (id)  network send
"sum(sum by (container_name)( rate(container_cpu_usage_seconds_total[1m] ) )) / count(node_cpu_seconds_total{mode=\"system\"}) * 100



disc I/O requires node_exporter (linux only)
-sum(rate(node_disk_bytes_read[$interval])) by (device)
sum(rate(node_disk_bytes_written[$interval])) by (device)
