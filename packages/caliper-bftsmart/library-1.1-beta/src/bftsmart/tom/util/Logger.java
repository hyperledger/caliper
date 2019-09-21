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

import java.text.SimpleDateFormat;
import java.util.Date;

public class Logger {

    //public static long startInstant = System.currentTimeMillis();
    public static boolean debug = false;

    public static void println(String msg) {
        if (debug) {
            String dataActual = new SimpleDateFormat("yy/MM/dd HH:mm:ss").format(new Date());
            System.out.println(
                    "(" + dataActual
                    + " - " + Thread.currentThread().getName()
                    + ") " + msg);
        }
    }

    public static void println2(java.util.logging.Logger l,String msg) {
        if (debug) {
            String dataActual = new SimpleDateFormat("HH:mm:ss:SSS").format(new Date());
            StackTraceElement stackTraceElement = Thread.currentThread().getStackTrace()[2];
            l.info(
                    "(" + dataActual
                    //+ " - " + Thread.currentThread().getName()
                    //+ " - " + stackTraceElement.getClassName() + "." + stackTraceElement.getMethodName()+":"+stackTraceElement.getLineNumber()
                    + ") " + msg);
        }
    }
}
