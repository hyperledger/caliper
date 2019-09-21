/**
Copyright (c) 2007-2013 Alysson Bessani, Eduardo Alchieri, Paulo Sousa, and the authors indicated in the @author tags

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package bftsmart.tom.util;


public class Storage {
    
    
    private long[] values;
    private int count = 0;
    
    
    /** Creates a new instance of Storage */
    public Storage(int size) {
        values = new long[size];
    }
    
    public int getCount(){
        return count;
    }

    public void reset(){
        count=0;
    }
    
    public void store(long value){
        if(count < values.length){
            values[count++] = value;
        }
    }
    
    public long getAverage(boolean limit){
        return computeAverage(values,limit);
    }
    
    public double getDP(boolean limit){
        return computeDP(values,limit);
    }
    
    public long[] getValues(){
        return values;
    }
    
    public long getMax(boolean limit){
        return computeMax(values,limit);
    }
    
    private long computeAverage(long[] values, boolean percent){
        java.util.Arrays.sort(values);
        int limit = 0;
        if(percent){
            limit = values.length/10;
        }
        long count = 0;
        for(int i = limit; i < values.length - limit;i++){
            count = count + values[i];
        }
        return count/(values.length - 2*limit);
    }
    
    private long computeMax(long[] values, boolean percent){
        java.util.Arrays.sort(values);
        int limit = 0;
        if(percent){
            limit = values.length/10;
        }
        long max = 0;
        for(int i = limit; i < values.length - limit;i++){
            if (values[i]>max){
                max = values[i];
            }
        }
        return max;
    }
    
    private double computeDP(long[] values, boolean percent){
        if(values.length <= 1){
            return 0;
        }
        java.util.Arrays.sort(values);
        int limit = 0;
        if(percent){
            limit = values.length/10;
        }
        long num = 0;
        long med = computeAverage(values,percent);
        long quad = 0;
        
        for(int i = limit; i < values.length - limit;i++){
            num++;
            quad = quad + values[i]*values[i]; //Math.pow(values[i],2);
        }
        long var = (quad - (num*(med*med)))/(num-1);
        ////br.ufsc.das.util.Logger.println("mim: "+values[limit]);
        ////br.ufsc.das.util.Logger.println("max: "+values[values.length-limit-1]);
        return Math.sqrt((double)var);
    }
    
    
}
